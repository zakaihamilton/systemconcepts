// @ts-check

import { fetchJSON } from "@util/api/fetch";
import { logger as structuredLogger } from "@util/api/logger";
import { roleAuth } from "@util/auth/roles";
import storage from "@util/storage/storage";
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
import { normalizeSyncUserId } from "./userStorage";

const defaultDependencies = {
	cookies: Cookies,
	fetchJSON,
	roleAuth,
	logger: structuredLogger,
	addSyncLog,
	configs: SYNC_CONFIG,
	storage,
	getReadOnlyManifestFreshness,
	persistManifestSignature,
	executeSyncPipeline,
	lockMutex,
	isMutexLocked,
	getMutex,
};

/**
 * @param {Partial<typeof defaultDependencies>} [overrides]
 */
export function createSyncOrchestrator(overrides = {}) {
	const dependencies = { ...defaultDependencies, ...overrides };

	/**
	 * @param {string | undefined} role
	 */
	async function refreshRole(role) {
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

	/**
	 * @param {boolean} forceReload
	 * @returns {Promise<import("./types").SyncResult>}
	 */
	return async function performSync(forceReload) {
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
				/** @type {any} */ (SyncActiveStore).update(
					(/** @type {import("./types").SyncState} */ state) => {
						state.phase = config.name.toLowerCase();
					},
				);
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
