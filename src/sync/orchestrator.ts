import { fetchJSON } from "@util/api/fetch";
import { logger as structuredLogger } from "@util/api/logger";
import { roleAuth } from "@util/auth/roles";
import Cookies from "js-cookie";
import { SYNC_CONFIG } from "./config";
import {
	getReadOnlyManifestFreshness,
	persistManifestSignature,
} from "./freshnessService";
import { addSyncLog } from "./logs";
import { getMutex, isMutexLocked, lockMutex } from "./mutex";
import { executeSyncPipeline } from "./pipeline";
import { TOTAL_COMBINED_WEIGHT } from "./progressTracker";
import { SyncActiveStore, UpdateSessionsStore } from "./syncState";
import type { SyncResult } from "./types";
import { normalizeSyncUserId } from "./userStorage";

type OrchestratorDependencies = Omit<
	typeof defaultDependencies,
	"cookies" | "logger" | "fetchJSON"
> & {
	cookies: {
		get(name: string): string | undefined;
		set(name: string, value: string, options?: { expires: number }): unknown;
	};
	logger: Pick<typeof structuredLogger, "debug" | "warn" | "error">;
	fetchJSON(url: string): Promise<{ role?: string } | null>;
};

const defaultDependencies = {
	cookies: Cookies,
	fetchJSON: async (url: string) => {
		const user: unknown = await fetchJSON(url);
		return typeof user === "object" &&
			user !== null &&
			"role" in user &&
			typeof user.role === "string"
			? { role: user.role }
			: null;
	},
	roleAuth,
	logger: structuredLogger,
	addSyncLog,
	configs: SYNC_CONFIG,
	getReadOnlyManifestFreshness,
	persistManifestSignature,
	executeSyncPipeline,
	lockMutex,
	isMutexLocked,
	getMutex,
};

export function createSyncOrchestrator(
	overrides: Partial<OrchestratorDependencies> = {},
) {
	const dependencies: OrchestratorDependencies = {
		...defaultDependencies,
		...overrides,
	};

	async function refreshRole(role: string | undefined) {
		const id = dependencies.cookies.get("id");
		const hash = dependencies.cookies.get("hash");
		if (!id || !hash) return role;
		try {
			const user = await dependencies.fetchJSON("/api/login");
			if (user?.role) {
				dependencies.cookies.set("role", user.role, { expires: 60 });
				return user.role;
			}
		} catch (error) {
			dependencies.logger.error("[Sync] Failed to refresh role", error);
			const message = error instanceof Error ? error.message : String(error);
			dependencies.addSyncLog(`Role refresh failed: ${message}`, "error");
		}
		return role;
	}

	return async function performSync(forceReload: boolean): Promise<SyncResult> {
		const unlock = await dependencies.lockMutex({ id: "sync_process" });
		try {
			dependencies.logger.debug(
				`[Sync] Version: ${process.env.NEXT_PUBLIC_VERSION}`,
			);
			let role = dependencies.cookies.get("role");
			const userId = normalizeSyncUserId(dependencies.cookies.get("id"));
			const hash = dependencies.cookies.get("hash");
			if (!role && userId && hash) role = await refreshRole(role);
			if (!dependencies.roleAuth(role, "student")) {
				role = await refreshRole(role);
				if (!dependencies.roleAuth(role, "student")) {
					dependencies.addSyncLog(
						`Visitor access restricted (role: ${role || "none"}). Please contact Administrator for access.`,
						"warning",
					);
					UpdateSessionsStore.update((state) => {
						state.busy = false;
					});
					SyncActiveStore.update((state) => {
						state.busy = false;
					});
					return { completed: false, reason: "unauthorized" };
				}
			}

			SyncActiveStore.update((state) => {
				state.stopping = false;
			});
			dependencies.addSyncLog("Starting sync process...", "info");
			const startTime = performance.now();
			let currentOffset = 0;
			let hasAnyChanges = false;
			let allComplete = true;
			let stopped = false;

			for (const config of dependencies.configs) {
				if (SyncActiveStore.getRawState().stopping) {
					stopped = true;
					allComplete = false;
					dependencies.addSyncLog("Sync stopped by user", "warning");
					break;
				}
				const canUpload =
					(config.direction === "bi" || config.direction === "push") &&
					dependencies.roleAuth(role, config.uploadsRole) &&
					!SyncActiveStore.getRawState().locked;
				const freshness =
					!forceReload && !canUpload
						? await dependencies.getReadOnlyManifestFreshness(config, userId)
						: null;
				if (!forceReload && !canUpload && freshness?.fresh) {
					dependencies.addSyncLog(
						`${config.name} manifest unchanged; skipping sync`,
						"info",
					);
					continue;
				}
				SyncActiveStore.update((state) => {
					state.phase = config.name.toLowerCase();
				});
				const result = await dependencies.executeSyncPipeline(
					config,
					role,
					userId,
					currentOffset,
					TOTAL_COMBINED_WEIGHT,
				);
				currentOffset = result.newOffset;
				hasAnyChanges ||= result.hasChanges;
				allComplete &&= result.complete;
				if (result.complete) {
					dependencies.persistManifestSignature(freshness);
				} else {
					dependencies.addSyncLog(
						`${config.name} sync incomplete; pending files will be retried`,
						"warning",
					);
				}
				if (config.name === "Library" && result.hasChanges) {
					SyncActiveStore.update((state) => {
						state.libraryUpdateCounter = (state.libraryUpdateCounter || 0) + 1;
					});
					dependencies.addSyncLog("Library changes detected", "info");
				}
			}

			const duration = ((performance.now() - startTime) / 1000).toFixed(1);
			dependencies.addSyncLog(
				`Total sync time: ${duration}s`,
				allComplete ? "success" : "warning",
			);
			if (hasAnyChanges || forceReload) {
				SyncActiveStore.update((state) => {
					state.needsSessionReload = true;
					state.personalUpdateCounter = (state.personalUpdateCounter || 0) + 1;
				});
				dependencies.addSyncLog(
					"Changes detected - reloading sessions",
					"info",
				);
			} else {
				dependencies.addSyncLog("No changes detected", "info");
				UpdateSessionsStore.update((state) => {
					state.busy = false;
				});
			}
			if (!allComplete) {
				return {
					completed: false,
					reason:
						stopped || SyncActiveStore.getRawState().stopping
							? "stopped"
							: "incomplete",
				};
			}
			return { completed: true };
		} catch (error) {
			dependencies.logger.error("[Sync] Sync failed:", error);
			let message = error instanceof Error ? error.message : String(error);
			if (error === 401 || error === 403) message = "Please login to sync";
			dependencies.addSyncLog(`Sync failed: ${message}`, "error");
			UpdateSessionsStore.update((state) => {
				state.busy = false;
			});
			throw error;
		} finally {
			if (typeof unlock === "function") unlock();
			if (dependencies.isMutexLocked({ id: "sync_process" })) {
				const lock = dependencies.getMutex({ id: "sync_process" });
				if (lock) {
					lock._locks = 0;
					lock._locking = Promise.resolve();
					SyncActiveStore.update((state) => {
						state.busy = false;
						state.phase = null;
					});
				}
			}
			SyncActiveStore.update((state) => {
				state.phase = null;
			});
		}
	};
}

export const performSync = createSyncOrchestrator();
