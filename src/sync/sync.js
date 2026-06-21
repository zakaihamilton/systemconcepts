import { getMutex, isMutexLocked, lockMutex } from "@sync/mutex";
import { SyncActiveStore, UpdateSessionsStore } from "@sync/syncState";
import { fetchJSON } from "@util/api/fetch";
import { roleAuth } from "@util/auth/roles";
import { usePageVisibility } from "@util/browser/hooks";
import { useOnline } from "@util/browser/online";
import { makePath } from "@util/data/path";
import storage from "@util/storage/storage";
import Cookies from "js-cookie";
import { useEffect, useRef, useState } from "react";
import { readCompressedFile } from "./bundle";
import { SYNC_CONFIG } from "./config";
import { FILES_MANIFEST, FILES_MANIFEST_GZ } from "./constants";
import { findMissingManifestFiles } from "./freshness";
import {
	getSavedLibraryCounter,
	readLibraryCounter,
	saveLibraryCounter,
} from "./libraryCounter";
import { addSyncLog } from "./logs";
import { SyncProgressTracker, TOTAL_COMBINED_WEIGHT } from "./progressTracker";
import { deleteRemoteFiles } from "./steps/deleteRemoteFiles";
import { downloadUpdates } from "./steps/downloadUpdates";
// Step Imports
import { getLocalFiles } from "./steps/getLocalFiles";
import { migrateFromMongoDB } from "./steps/personal/migrateFromMongoDB";
import { removeDeletedFiles } from "./steps/removeDeletedFiles";
import { syncManifest } from "./steps/syncManifest";
import { updateLocalManifest } from "./steps/updateLocalManifest";
import { uploadManifest } from "./steps/uploadManifest";
import { uploadNewFiles } from "./steps/uploadNewFiles";
import { uploadUpdates } from "./steps/uploadUpdates";

export const AUTO_SYNC_INTERVAL_MS = 12 * 60 * 1000;
export const AUTO_SYNC_JITTER_MS = 60 * 1000;

function getCurrentVersion() {
	return process.env.NEXT_PUBLIC_VERSION || "dev";
}

function getAutoSyncJitter() {
	if (typeof window === "undefined") return 0;
	const storageKey = "sync_autoSyncJitter";
	const stored = Number.parseInt(localStorage.getItem(storageKey) || "", 10);
	if (Number.isFinite(stored) && stored >= 0) return stored;
	const jitter = Math.floor(Math.random() * AUTO_SYNC_JITTER_MS);
	localStorage.setItem(storageKey, String(jitter));
	return jitter;
}

function shouldRunInitialAutoSync() {
	if (typeof window === "undefined") return false;
	const version = getCurrentVersion();
	const lastVersion = localStorage.getItem("sync_lastVersion");
	const lastSyncTime = SyncActiveStore.getRawState().lastSyncTime;
	return lastSyncTime === 0 || lastVersion !== version;
}

function persistAutoSyncVersion() {
	if (typeof window !== "undefined") {
		localStorage.setItem("sync_lastVersion", getCurrentVersion());
	}
}

function getManifestSignature(manifest) {
	if (!Array.isArray(manifest)) return "";
	return JSON.stringify(
		manifest.map(({ path, modified, version, hash }) => [
			path,
			modified,
			version,
			hash,
		]),
	);
}

export async function getReadOnlyManifestFreshness(config, userid) {
	if (typeof window === "undefined" || config.migration) return null;
	const resolvedRemotePath = config.remotePath.replace("{userid}", userid);
	const manifestPath = makePath(resolvedRemotePath, FILES_MANIFEST_GZ);
	const storageKey = `sync_manifest_signature:${resolvedRemotePath}`;
	try {
		const manifest = await readCompressedFile(manifestPath);
		if (!manifest || !manifest.length) return null;
		const signature = getManifestSignature(manifest);
		const previousSignature = localStorage.getItem(storageKey);
		const missingLocalFiles = [];
		if (previousSignature === signature) {
			missingLocalFiles.push(
				...(await findMissingManifestFiles(manifest, config.localPath, (path) =>
					storage.exists(path),
				)),
			);
		}
		const fresh =
			previousSignature === signature && missingLocalFiles.length === 0;
		if (missingLocalFiles.length > 0) {
			addSyncLog(
				`${config.name} manifest is unchanged but ${missingLocalFiles.length} local file(s) are missing; repairing`,
				"warning",
			);
			console.warn(
				`[Sync] ${config.name} local integrity check found missing files:`,
				missingLocalFiles,
			);
		}
		return {
			fresh,
			signature,
			storageKey,
			missingLocalFiles,
		};
	} catch (err) {
		console.warn(
			`[Sync] Manifest freshness check failed for ${resolvedRemotePath}:`,
			err.message || err,
		);
		return null;
	}
}

function persistManifestSignature(freshness) {
	if (typeof window !== "undefined" && freshness?.storageKey) {
		localStorage.setItem(freshness.storageKey, freshness.signature);
	}
}

async function getCachedLocalManifest(localPath) {
	const localManifestPath = makePath(localPath, FILES_MANIFEST);
	if (!(await storage.exists(localManifestPath))) {
		return null;
	}

	try {
		const content = await storage.readFile(localManifestPath);
		const manifest = content ? JSON.parse(content) : [];
		return Array.isArray(manifest) ? manifest : null;
	} catch (err) {
		console.warn("[Sync] Failed to read cached local manifest:", err);
		return null;
	}
}

async function getLibraryLocalFiles(localPath, config) {
	if (!config.useChangeCounter) {
		return {
			localFiles: await getLocalFiles(localPath, config),
			skipHashing: false,
		};
	}

	const counter = await readLibraryCounter();
	const savedCounter = getSavedLibraryCounter();
	const cachedManifest = await getCachedLocalManifest(localPath);

	if (cachedManifest && savedCounter === counter) {
		addSyncLog(
			`Library counter unchanged (${counter}); skipping local library scan`,
			"info",
		);
		return {
			localFiles: cachedManifest
				.filter((entry) => !entry.deleted)
				.map((entry) => ({
					path: entry.path,
					fullPath: makePath(localPath, entry.path),
				})),
			libraryCounter: counter,
			skipHashing: true,
		};
	}

	if (savedCounter !== null) {
		addSyncLog(
			`Library counter changed (${savedCounter} -> ${counter}); checking library files`,
			"info",
		);
	}

	return {
		localFiles: await getLocalFiles(localPath, config),
		libraryCounter: counter,
		skipHashing: false,
	};
}

/**
 * Execute a single sync pipeline for a given configuration
 * @param {object} config - Sync configuration object
 * @param {string} role - Current user role
 * @param {string} userid - Current user ID
 */
async function executeSyncPipeline(
	config,
	role,
	userid,
	phaseOffset = 0,
	combinedTotalWeight = null,
) {
	const {
		name,
		localPath,
		remotePath,
		uploadsRole,
		migration,
		restoreMissingFiles,
	} = config;
	const label = name;

	const start = performance.now();
	addSyncLog(`Starting ${label} sync...`, "info");
	const progress = new SyncProgressTracker(phaseOffset, combinedTotalWeight);
	if (migration) {
		progress.usePersonalWeights();
	}
	let hasChanges = false;
	const isLocked = SyncActiveStore.getRawState().locked;

	// Resolve paths (handle {userid} interpolation)
	const resolvedRemotePath = remotePath.replace("{userid}", userid);

	const canUpload =
		(config.direction === "bi" || config.direction === "push") &&
		roleAuth(role, uploadsRole) &&
		!isLocked;

	addSyncLog(
		`Phase: ${label}, Role: ${role || "none"}, Uploads: ${canUpload ? "Allowed" : "Restricted"}`,
		"info",
	);

	if (
		!canUpload &&
		(config.direction === "bi" || config.direction === "push")
	) {
		console.warn(
			`[Sync] Upload restricted for ${label}. Role: ${role}, Allowed: ${uploadsRole}, Locked: ${isLocked}`,
		);
		if (isLocked) {
			addSyncLog(`Uploads skipped (Sync is Locked)`, "warning");
		} else if (!roleAuth(role, uploadsRole)) {
			addSyncLog(
				`Insufficient permissions for ${label} uploads (Role: ${role})`,
				"warning",
			);
		}
	}

	// Ensure local folder exists
	await storage.createFolderPath(makePath(localPath, "dummy"));

	// Step 1
	progress.updateProgress("getLocalFiles", { processed: 0, total: 1 });
	let {
		localFiles,
		libraryCounter: initialLibraryCounter,
		skipHashing,
	} = await getLibraryLocalFiles(localPath, config);
	progress.completeStep("getLocalFiles");

	// Step 2 & 3: Sync manifests
	progress.updateProgress("syncManifest", { processed: 0, total: 1 });
	// Personal sync uses migration to populate manifest, so we skip the expensive scan
	// if the manifest is missing (it will be created during migration)
	const skipScan = !!migration;
	let remoteManifest = await syncManifest(
		resolvedRemotePath,
		isLocked,
		skipScan,
	);
	const loadedFromManifest = !!remoteManifest.loadedFromManifest;
	progress.completeStep("syncManifest");

	// Step 3.5: Migrate from MongoDB if needed
	let migrationOccurred = false;
	if (migration) {
		progress.updateProgress("migrateFromMongoDB", { processed: 0, total: 1 });
		try {
			// The file has been moved to src/sync/steps/personal/migrateFromMongoDB.js
			const migrationResult = await migrateFromMongoDB(
				userid,
				remoteManifest,
				localPath,
				canUpload,
			);

			if (migrationResult.migrated) {
				migrationOccurred = true;
				addSyncLog(
					`[${label}] Migration complete: ${migrationResult.fileCount} files`,
					"success",
				);

				if (migrationResult.deletedKeys) {
					const deletedKeysSet = new Set(migrationResult.deletedKeys);
					remoteManifest = remoteManifest.filter(
						(entry) => !deletedKeysSet.has(entry.path),
					);
				}

				// Update local manifest
				const manifestPath = makePath(localPath, FILES_MANIFEST);
				if (await storage.exists(manifestPath)) {
					// Just verify it exists
				}

				if (migrationResult.manifest) {
					const remotePaths = new Set(remoteManifest.map((e) => e.path));
					for (const entry of migrationResult.manifest) {
						if (!remotePaths.has(entry.path)) {
							remoteManifest.push({
								...entry,
								hash: "FORCE_UPLOAD",
								modified: 0,
								version: entry.version || 1,
							});
						}
					}
				}

				localFiles = await getLocalFiles(localPath, config);
				skipHashing = false;
			}
		} catch (err) {
			console.error(`[${label}] Migration failed:`, err);
			addSyncLog(`Migration failed: ${err.message}`, "error");
		}
		progress.completeStep("migrateFromMongoDB");
	}

	progress.updateProgress("updateLocalManifest", { processed: 0, total: 1 });
	let localManifest = await updateLocalManifest(
		localFiles,
		localPath,
		remoteManifest,
		{ skipHashing },
	);
	progress.completeStep("updateLocalManifest");

	// Step 4
	progress.updateProgress("downloadUpdates", { processed: 0, total: 1 });
	const downloadResult = await downloadUpdates(
		localManifest,
		remoteManifest,
		localPath,
		resolvedRemotePath,
		canUpload,
		progress,
		restoreMissingFiles,
	);
	localManifest = downloadResult.manifest;
	remoteManifest = downloadResult.cleanedRemoteManifest || remoteManifest;
	hasChanges = hasChanges || downloadResult.hasChanges;
	progress.completeStep("downloadUpdates");

	// Step 4.5: Remove files that were deleted on remote
	progress.updateProgress("removeDeletedFiles", { processed: 0, total: 1 });
	const removeResult = await removeDeletedFiles(
		localManifest,
		remoteManifest,
		localPath,
		!canUpload,
	);
	localManifest = removeResult.manifest;
	hasChanges = hasChanges || removeResult.hasChanges;
	progress.completeStep("removeDeletedFiles");

	if (canUpload) {
		// Step 5
		progress.updateProgress("uploadUpdates", { processed: 0, total: 1 });
		const uploadUpdatesResult = await uploadUpdates(
			localManifest,
			remoteManifest,
			localPath,
			resolvedRemotePath,
			progress,
		);
		remoteManifest = uploadUpdatesResult.manifest;
		hasChanges = hasChanges || uploadUpdatesResult.hasChanges;
		progress.completeStep("uploadUpdates");

		// Step 6
		progress.updateProgress("uploadNewFiles", { processed: 0, total: 1 });
		const uploadNewResult = await uploadNewFiles(
			localManifest,
			remoteManifest,
			localPath,
			resolvedRemotePath,
			progress,
		);
		remoteManifest = uploadNewResult.manifest;
		hasChanges = hasChanges || uploadNewResult.hasChanges;
		progress.completeStep("uploadNewFiles");

		// Step 6.5: Delete files from remote that were marked as deleted locally
		progress.updateProgress("deleteRemoteFiles", { processed: 0, total: 1 });
		const deletedPaths = await deleteRemoteFiles(
			localManifest,
			resolvedRemotePath,
		);
		if (deletedPaths.length > 0) {
			hasChanges = true;
			// Clean up local manifest: remove the tombstoned entries
			const deletedPathsSet = new Set(deletedPaths);
			localManifest = localManifest.filter(
				(f) => !f.deleted || !deletedPathsSet.has(f.path),
			);

			// Update remote manifest: remove the deleted files
			remoteManifest = remoteManifest.filter(
				(f) => !deletedPathsSet.has(f.path),
			);

			// Save the cleaned local manifest
			const localManifestPath = makePath(localPath, FILES_MANIFEST);
			await storage.writeFile(
				localManifestPath,
				JSON.stringify(localManifest, null, 4),
			);
		}
		progress.completeStep("deleteRemoteFiles");

		// Step 7
		progress.updateProgress("uploadManifest", { processed: 0, total: 1 });
		// Only upload manifest if:
		// 1. We have changes to sync
		// 2. OR The manifest was generated from listing (loadedFromManifest=false) and needs saving
		// 3. OR Migration actually occurred (which means we might have new files not yet in manifest)
		if (hasChanges || !loadedFromManifest || migrationOccurred) {
			await uploadManifest(remoteManifest, resolvedRemotePath);
		} else {
			console.log(
				`[Sync] Skipping manifest upload (no changes and manifest unchanged)`,
			);
		}
		progress.completeStep("uploadManifest"); // Fix: actually complete step 7
	} else {
		// Skip upload steps UI progress
		progress.completeStep("uploadUpdates");
		progress.completeStep("uploadNewFiles");
		progress.completeStep("deleteRemoteFiles");
		progress.completeStep("uploadManifest");
	}

	progress.setComplete();

	const duration = ((performance.now() - start) / 1000).toFixed(1);
	addSyncLog(
		`✓ ${label} sync complete (${remoteManifest.length} files) in ${duration}s`,
		"success",
	);

	if (config.useChangeCounter) {
		const finalLibraryCounter = await readLibraryCounter();
		saveLibraryCounter(finalLibraryCounter);
		if (finalLibraryCounter !== initialLibraryCounter) {
			SyncActiveStore.update((s) => {
				s.libraryUpdateCounter = (s.libraryUpdateCounter || 0) + 1;
			});
		}
	}

	// Return the new offset for the next phase
	return {
		hasChanges,
		complete: downloadResult.complete,
		newOffset: progress.getCurrentOffset(),
	};
}

/**
 * Main sync function
 */
export async function performSync(forceReload) {
	const unlock = await lockMutex({ id: "sync_process" });
	try {
		console.log(`[Sync] Version: ${process.env.NEXT_PUBLIC_VERSION}`);
		let role = Cookies.get("role");
		const id = Cookies.get("id");
		const hash = Cookies.get("hash");

		if (!role && id && hash) {
			console.log("[Sync] Role undefined but logged in, fetching...");
			try {
				const user = await fetchJSON("/api/login", {
					headers: { id, hash },
				});
				if (user && user.role) {
					role = user.role;
					Cookies.set("role", role, { expires: 60 });
					console.log("[Sync] Role fetched:", role);
				}
			} catch (err) {
				console.error("[Sync] Failed to fetch role:", err);
			}
		}

		console.log("[Sync] Initial role check:", role);

		if (!roleAuth(role, "student")) {
			// Role is restricted, check server for updates
			console.log("[Sync] Role restricted, attempting refresh...");
			try {
				const id = Cookies.get("id");
				const hash = Cookies.get("hash");
				if (id && hash) {
					const user = await fetchJSON("/api/login", {
						headers: { id, hash },
					});
					console.log("[Sync] Refresh result:", user);
					if (user && user.role) {
						role = user.role;
						Cookies.set("role", role, { expires: 60 });
						console.log("[Sync] Role updated to:", role);
					}
				}
			} catch (err) {
				console.error("[Sync] Failed to refresh role", err);
				addSyncLog(
					`Role refresh failed: ${err.message || String(err)}`,
					"error",
				);
			}

			if (roleAuth(role, "student")) {
				console.log(
					"[Sync] Role refreshed and authorized. Proceeding with sync.",
				);
			} else {
				console.warn(
					"[Sync] Access still restricted after refresh. Role:",
					role,
				);
				addSyncLog(
					`Visitor access restricted (role: ${role || "none"}). Please contact Administrator for access.`,
					"warning",
				);
				UpdateSessionsStore.update((s) => {
					s.busy = false; // FIX: Reset busy state
				});
				SyncActiveStore.update((s) => {
					s.busy = false; // FIX: Reset busy state
				});
				return;
			}
		}

		// Reset stopping state before we begin
		SyncActiveStore.update((s) => {
			s.stopping = false;
		});

		addSyncLog("Starting sync process...", "info");
		const startTime = performance.now();

		// 1. Main Sync (starts at offset 0)
		// Execute pipelines from config
		let currentOffset = 0;
		let hasAnyChanges = false;

		for (const config of SYNC_CONFIG) {
			if (SyncActiveStore.getRawState().stopping) {
				addSyncLog("Sync stopped by user", "warning");
				break;
			}
			const canUploadForConfig =
				(config.direction === "bi" || config.direction === "push") &&
				roleAuth(role, config.uploadsRole) &&
				!SyncActiveStore.getRawState().locked;
			const readOnlyFreshness =
				!forceReload && !canUploadForConfig
					? await getReadOnlyManifestFreshness(config, id)
					: null;
			if (!forceReload && !canUploadForConfig && readOnlyFreshness?.fresh) {
				addSyncLog(`${config.name} manifest unchanged; skipping sync`, "info");
				continue;
			}
			SyncActiveStore.update((s) => {
				s.phase = config.name.toLowerCase();
			});
			const result = await executeSyncPipeline(
				config,
				role,
				id,
				currentOffset,
				TOTAL_COMBINED_WEIGHT,
			);
			currentOffset = result.newOffset;
			hasAnyChanges = hasAnyChanges || result.hasChanges;
			if (result.complete) {
				persistManifestSignature(readOnlyFreshness);
			} else {
				addSyncLog(
					`${config.name} sync incomplete; pending files will be retried`,
					"warning",
				);
			}

			if (config.name === "Library" && result.hasChanges) {
				SyncActiveStore.update((s) => {
					s.libraryUpdateCounter = (s.libraryUpdateCounter || 0) + 1;
				});
				addSyncLog(`Library changes detected`, "info");
			}
		}

		const duration = ((performance.now() - startTime) / 1000).toFixed(1);
		addSyncLog(`Total sync time: ${duration}s`, "success");

		// Only trigger reload if sync actually changed something
		if (hasAnyChanges || forceReload) {
			SyncActiveStore.update((s) => {
				s.needsSessionReload = true;
			});
			addSyncLog(`Changes detected - reloading sessions`, "info");
		} else {
			addSyncLog(`No changes detected`, "info");
			UpdateSessionsStore.update((s) => {
				s.busy = false;
			});
		}
	} catch (err) {
		console.error("[Sync] Sync failed:", err);
		let errorMessage = err.message || String(err);
		if (err === 401 || err === 403) {
			errorMessage = "Please login to sync";
		}
		addSyncLog(`Sync failed: ${errorMessage}`, "error");
		UpdateSessionsStore.update((s) => {
			s.busy = false;
		});
		throw err;
	} finally {
		unlock();
		// Force unlock if still reports locked (double-safety)
		if (isMutexLocked({ id: "sync_process" })) {
			const lock = getMutex({ id: "sync_process" });
			if (lock) {
				lock._locks = 0;
				lock._locking = Promise.resolve();
				SyncActiveStore.update((s) => {
					s.busy = false; // FIX: Reset busy state
					s.phase = null;
				});
			}
		}
		SyncActiveStore.update((s) => {
			s.phase = null;
		});
	}
}

export async function stopSync() {
	addSyncLog("Stopping sync...", "warning");
	SyncActiveStore.update((s) => {
		s.stopping = true;
	});
}

export async function requestSync(forceReload) {
	const state = SyncActiveStore.getRawState();
	const isBusy = state.busy;
	const isLocked = state.locked;
	const isSessionsBusy = UpdateSessionsStore.getRawState().busy;

	if (isLocked) {
		addSyncLog("Sync is locked (skipping upload)", "warning");
	}

	if (isBusy || isSessionsBusy) {
		if (state.stopping) {
			addSyncLog("Waiting for current sync to stop...", "info");
		}
		return;
	}

	SyncActiveStore.update((s) => {
		s.busy = true;
		s.stopping = false; // Reset stopping state
		s.startTime = Date.now();
		s.lastSyncTime = Date.now(); // Track when we started this sync
		s.logs = [];
	});

	try {
		await performSync(forceReload);

		const endTime = Date.now();
		const syncDuration = endTime - SyncActiveStore.getRawState().startTime;
		persistAutoSyncVersion();
		SyncActiveStore.update((s) => {
			s.busy = false;
			s.lastSynced = endTime;
			s.lastDuration = syncDuration;
			s.counter++;
		});
	} catch {
		SyncActiveStore.update((s) => {
			s.busy = false; // FIX: Reset busy state in outer catch
		});
	}
}

export function useSyncFeature() {
	const state = SyncActiveStore.useState((s) => ({
		busy: s.busy,
		lastSynced: s.lastSynced,
		logs: s.logs,
		lastDuration: s.lastDuration,
		startTime: s.startTime,
		progress: s.progress,
		personalSyncBusy: s.personalSyncBusy,
		personalSyncError: s.personalSyncError,
		phase: s.phase,
	}));

	const {
		busy,
		lastSynced,
		logs,
		lastDuration: duration,
		startTime,
		progress,
		personalSyncBusy,
		personalSyncError,
		phase,
	} = state;

	const percentage =
		progress && progress.total > 0
			? Math.round((progress.processed / progress.total) * 100)
			: 0;

	// Cap at 99% while syncing to indicate work in progress
	const isSyncing = busy || personalSyncBusy;
	const displayPercentage = isSyncing && percentage >= 100 ? 99 : percentage;

	return {
		sync: () => requestSync(true),
		stop: stopSync,
		busy,
		lastSynced,
		duration,
		logs,
		percentage: displayPercentage,
		startTime,
		personalSyncBusy,
		personalSyncError,
		phase,
	};
}

export function useSync(options = {}) {
	const { active = true } = options;
	const online = useOnline();
	const isSignedIn = Cookies.get("id") && Cookies.get("hash");
	const isVisible = usePageVisibility();
	const { busy, autoSync } = SyncActiveStore.useState((s) => ({
		busy: s.busy,
		autoSync: s.autoSync,
	}));
	const [counter, setCounter] = useState(0);
	const timerRef = useRef(null);

	useEffect(() => {
		if (!active || !online || !isSignedIn || !isVisible || !autoSync) {
			return;
		}

		const checkSync = () => {
			const now = Date.now();
			const lastSyncTime = SyncActiveStore.getRawState().lastSyncTime;
			const timeSinceLastSync = now - lastSyncTime;
			const sessionsBusy = UpdateSessionsStore.getRawState().busy;
			const autoSyncInterval = AUTO_SYNC_INTERVAL_MS + getAutoSyncJitter();

			if (timeSinceLastSync >= autoSyncInterval && !busy && !sessionsBusy) {
				requestSync(false);
			}
		};

		// Sync immediately only on a fresh session or after an app version change.
		if (shouldRunInitialAutoSync()) {
			const sessionsBusy = UpdateSessionsStore.getRawState().busy;
			if (!sessionsBusy) {
				requestSync(false);
			}
		}

		timerRef.current = setInterval(
			checkSync,
			Math.max(60 * 1000, AUTO_SYNC_INTERVAL_MS / 2),
		);

		return () => {
			if (timerRef.current) {
				clearInterval(timerRef.current);
			}
		};
	}, [active, online, isSignedIn, isVisible, busy, autoSync]);

	useEffect(() => {
		const unsubscribe = SyncActiveStore.subscribe(
			(s) => s.counter,
			(newCounter) => setCounter(newCounter),
		);
		return unsubscribe;
	}, []);

	return [counter, busy];
}

export async function clearBundleCache() {
	try {
		addSyncLog("Clearing all sync data...", "warning");

		for (const config of SYNC_CONFIG) {
			await storage.deleteFolder(config.localPath);
		}

		SyncActiveStore.update((s) => {
			s.lastSynced = 0;
			s.counter = 0;
			s.busy = false; // Reset busy state
			s.phase = null; // Reset phase
			s.logs = [];
		});
		addSyncLog("✓ All sync data cleared", "success");
	} catch (err) {
		console.error("[Sync] Error clearing cache:", err);
	}
}

export { addSyncLog };
