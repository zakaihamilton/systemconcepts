// @ts-check

import { logger as structuredLogger } from "@util/api/logger";
import { roleAuth } from "@util/auth/roles";
import { makePath } from "@util/data/path";
import storage from "@util/storage/storage";
import { FILES_MANIFEST } from "./constants";
import {
	getSavedLibraryCounter,
	readLibraryCounter,
	saveLibraryCounter,
} from "./libraryCounter";
import { addSyncLog } from "./logs";
import { applyManifestUpdates } from "./manifest";
import { SyncProgressTracker } from "./progressTracker";
import { applyRemoteTombstones } from "./steps/applyRemoteTombstones";
import { deleteRemoteFiles } from "./steps/deleteRemoteFiles";
import { downloadUpdates } from "./steps/downloadUpdates";
import { getLocalFiles } from "./steps/getLocalFiles";
import { migrateFromMongoDB } from "./steps/personal/migrateFromMongoDB";
import { removeDeletedFiles } from "./steps/removeDeletedFiles";
import { syncManifest } from "./steps/syncManifest";
import { updateLocalManifest } from "./steps/updateLocalManifest";
import { uploadManifest } from "./steps/uploadManifest";
import { uploadNewFiles } from "./steps/uploadNewFiles";
import { uploadUpdates } from "./steps/uploadUpdates";
import { readFileIfExists } from "./storageReads";
import { SyncActiveStore } from "./syncState";
import { createSyncTrashId } from "./trash";

const defaultDependencies = {
	storage,
	roleAuth,
	addSyncLog,
	logger: structuredLogger,
	ProgressTracker: SyncProgressTracker,
	getLocalFiles,
	readLibraryCounter,
	getSavedLibraryCounter,
	saveLibraryCounter,
	syncManifest,
	migrateFromMongoDB,
	updateLocalManifest,
	downloadUpdates,
	removeDeletedFiles,
	uploadUpdates,
	uploadNewFiles,
	deleteRemoteFiles,
	applyRemoteTombstones,
	uploadManifest,
	createSyncTrashId,
};

/** @typedef {{
 * storage: any,
 * roleAuth: (...args: any[]) => boolean,
 * addSyncLog: (...args: any[]) => void,
 * logger: any,
 * ProgressTracker: any,
 * getLocalFiles: (...args: any[]) => Promise<any>,
 * readLibraryCounter: (...args: any[]) => Promise<any>,
 * getSavedLibraryCounter: (...args: any[]) => any,
 * saveLibraryCounter: (...args: any[]) => any,
 * syncManifest: (...args: any[]) => Promise<any>,
 * migrateFromMongoDB: (...args: any[]) => Promise<any>,
 * updateLocalManifest: (...args: any[]) => Promise<any>,
 * downloadUpdates: (...args: any[]) => Promise<any>,
 * removeDeletedFiles: (...args: any[]) => Promise<any>,
 * uploadUpdates: (...args: any[]) => Promise<any>,
 * uploadNewFiles: (...args: any[]) => Promise<any>,
 * deleteRemoteFiles: (...args: any[]) => any,
 * applyRemoteTombstones: (...args: any[]) => Promise<any>,
 * uploadManifest: (...args: any[]) => Promise<any>,
 * createSyncTrashId: () => string
 * }} PipelineDependencies */

/**
 * @param {string} localPath
 * @param {import("./types").SyncConfig} config
 * @param {PipelineDependencies} dependencies
 */
async function getLibraryLocalFiles(localPath, config, dependencies) {
	if (!config.useChangeCounter) {
		return {
			localFiles: await dependencies.getLocalFiles(localPath, config),
			skipHashing: false,
		};
	}
	const counter = await dependencies.readLibraryCounter();
	const savedCounter = dependencies.getSavedLibraryCounter();
	const manifestPath = makePath(localPath, FILES_MANIFEST);
	let cachedManifest = null;
	try {
		const content = await readFileIfExists(dependencies.storage, manifestPath);
		if (content !== null) {
			const parsed = content ? JSON.parse(content) : [];
			cachedManifest = Array.isArray(parsed) ? parsed : null;
		}
	} catch (error) {
		dependencies.logger.warn(
			"[Sync] Failed to read cached local manifest:",
			error,
		);
	}
	if (cachedManifest && savedCounter === counter) {
		dependencies.addSyncLog(
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
		dependencies.addSyncLog(
			`Library counter changed (${savedCounter} -> ${counter}); checking library files`,
			"info",
		);
	}
	return {
		localFiles: await dependencies.getLocalFiles(localPath, config),
		libraryCounter: counter,
		skipHashing: false,
	};
}

/**
 * @param {Partial<typeof defaultDependencies>} [overrides]
 */
export function createSyncPipeline(overrides = {}) {
	/** @type {PipelineDependencies} */
	const dependencies = { ...defaultDependencies, ...overrides };

	/**
	 * @param {import("./types").SyncConfig} config
	 * @param {string | undefined} role
	 * @param {string} userId
	 * @param {number} [phaseOffset]
	 * @param {number | null} [combinedTotalWeight]
	 * @returns {Promise<import("./types").PipelineResult>}
	 */
	return async function executeSyncPipeline(
		config,
		role,
		userId,
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
		const start = performance.now();
		dependencies.addSyncLog(`Starting ${name} sync...`, "info");
		const progress = new dependencies.ProgressTracker(
			phaseOffset,
			combinedTotalWeight,
		);
		if (migration) progress.usePersonalWeights();
		let hasChanges = false;
		let phaseComplete = true;
		const syncId = dependencies.createSyncTrashId();
		const isLocked = SyncActiveStore.getRawState().locked;
		const resolvedRemotePath = remotePath.replace("{userid}", userId);
		const canUpload =
			(config.direction === "bi" || config.direction === "push") &&
			dependencies.roleAuth(role, uploadsRole) &&
			!isLocked;

		dependencies.addSyncLog(
			`Phase: ${name}, Role: ${role || "none"}, Uploads: ${canUpload ? "Allowed" : "Restricted"}`,
			"info",
		);
		if (
			!canUpload &&
			(config.direction === "bi" || config.direction === "push")
		) {
			dependencies.logger.warn(
				`[Sync] Upload restricted for ${name}. Role: ${role}, Allowed: ${uploadsRole}, Locked: ${isLocked}`,
			);
			dependencies.addSyncLog(
				isLocked
					? "Uploads skipped (Sync is Locked)"
					: `Insufficient permissions for ${name} uploads (Role: ${role})`,
				"warning",
			);
		}

		await dependencies.storage.createFolderPath(makePath(localPath, "dummy"));
		progress.updateProgress("getLocalFiles", { processed: 0, total: 1 });
		let {
			localFiles,
			libraryCounter: initialLibraryCounter,
			skipHashing,
		} = await getLibraryLocalFiles(localPath, config, dependencies);
		progress.completeStep("getLocalFiles");

		progress.updateProgress("syncManifest", { processed: 0, total: 1 });
		let remoteManifest = await dependencies.syncManifest(
			resolvedRemotePath,
			isLocked,
			!!migration,
		);
		const loadedFromManifest = !!remoteManifest.loadedFromManifest;
		const remoteManifestAuthoritative = !!remoteManifest.authoritative;
		progress.completeStep("syncManifest");

		let migrationOccurred = false;
		let migrationComplete = true;
		if (migration) {
			progress.updateProgress("migrateFromMongoDB", {
				processed: 0,
				total: 1,
			});
			try {
				const migrationResult = await dependencies.migrateFromMongoDB(
					userId,
					remoteManifest,
					localPath,
					canUpload,
				);
				if (migrationResult.migrated) {
					migrationOccurred = true;
					dependencies.addSyncLog(
						`[${name}] Migration complete: ${migrationResult.fileCount} files`,
						"success",
					);
					if (migrationResult.deletedKeys) {
						const deletedKeys = new Set(migrationResult.deletedKeys);
						remoteManifest = remoteManifest.filter(
							(/** @type {import("./types").ManifestEntry} */ entry) =>
								!deletedKeys.has(entry.path),
						);
					}
					if (migrationResult.manifest) {
						const remotePaths = new Set(
							remoteManifest.map(
								(/** @type {import("./types").ManifestEntry} */ entry) =>
									entry.path,
							),
						);
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
					localFiles = await dependencies.getLocalFiles(localPath, config);
					skipHashing = false;
				}
			} catch (error) {
				migrationComplete = false;
				const message = error instanceof Error ? error.message : String(error);
				dependencies.logger.error(`[${name}] Migration failed:`, error);
				dependencies.addSyncLog(`Migration failed: ${message}`, "error");
			}
			progress.completeStep("migrateFromMongoDB");
		}

		progress.updateProgress("updateLocalManifest", { processed: 0, total: 1 });
		let localManifest = await dependencies.updateLocalManifest(
			localFiles,
			localPath,
			remoteManifest,
			{ skipHashing },
		);
		progress.completeStep("updateLocalManifest");

		progress.updateProgress("downloadUpdates", { processed: 0, total: 1 });
		const downloadResult = await dependencies.downloadUpdates(
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
		hasChanges ||= downloadResult.hasChanges;
		phaseComplete &&= downloadResult.complete !== false;
		progress.completeStep("downloadUpdates");

		progress.updateProgress("removeDeletedFiles", { processed: 0, total: 1 });
		const removeResult = await dependencies.removeDeletedFiles(
			localManifest,
			remoteManifest,
			localPath,
			!canUpload,
		);
		localManifest = removeResult.manifest;
		hasChanges ||= removeResult.hasChanges;
		progress.completeStep("removeDeletedFiles");

		if (canUpload) {
			progress.updateProgress("uploadUpdates", { processed: 0, total: 1 });
			const updateResult = await dependencies.uploadUpdates(
				localManifest,
				remoteManifest,
				localPath,
				resolvedRemotePath,
				progress,
			);
			remoteManifest = updateResult.manifest;
			hasChanges ||= updateResult.hasChanges;
			phaseComplete &&= updateResult.complete !== false;
			progress.completeStep("uploadUpdates");

			progress.updateProgress("uploadNewFiles", { processed: 0, total: 1 });
			const newResult = await dependencies.uploadNewFiles(
				localManifest,
				remoteManifest,
				localPath,
				resolvedRemotePath,
				progress,
			);
			remoteManifest = newResult.manifest;
			hasChanges ||= newResult.hasChanges;
			phaseComplete &&= newResult.complete !== false;
			progress.completeStep("uploadNewFiles");

			progress.updateProgress("uploadManifest", { processed: 0, total: 1 });
			const deletionSafe =
				phaseComplete &&
				migrationComplete &&
				remoteManifestAuthoritative &&
				!SyncActiveStore.getRawState().stopping;
			const localTombstones = localManifest.filter(
				(/** @type {import("./types").ManifestEntry} */ entry) => entry.deleted,
			);
			if (deletionSafe && localTombstones.length > 0) {
				remoteManifest = await applyManifestUpdates(
					remoteManifest,
					localTombstones,
				);
				hasChanges = true;
			} else if (!deletionSafe && localTombstones.length > 0) {
				dependencies.addSyncLog(
					`Deletion blocked for ${name}: sync phase is incomplete`,
					"warning",
				);
			}
			if (
				phaseComplete &&
				(hasChanges || !loadedFromManifest || migrationOccurred)
			) {
				await dependencies.uploadManifest(remoteManifest, resolvedRemotePath);
			} else if (phaseComplete) {
				dependencies.logger.debug(
					"[Sync] Skipping manifest upload (no changes and manifest unchanged)",
				);
			} else {
				dependencies.addSyncLog(
					`Manifest publication blocked for ${name}: sync phase is incomplete`,
					"warning",
				);
			}
			progress.completeStep("uploadManifest");

			progress.updateProgress("deleteRemoteFiles", { processed: 0, total: 1 });
			if (deletionSafe && localTombstones.length > 0) {
				const trashResult = await dependencies.deleteRemoteFiles(
					localManifest,
					resolvedRemotePath,
					syncId,
				);
				phaseComplete &&= trashResult.complete !== false;
			} else if (localTombstones.length > 0) {
				dependencies.addSyncLog(
					"Remote files retained because deletion safety checks did not pass",
					"warning",
				);
			}
			progress.completeStep("deleteRemoteFiles");
		} else {
			for (const step of [
				"uploadUpdates",
				"uploadNewFiles",
				"deleteRemoteFiles",
				"uploadManifest",
			]) {
				progress.completeStep(step);
			}
		}

		const localDeletionSafe =
			phaseComplete &&
			migrationComplete &&
			remoteManifestAuthoritative &&
			!SyncActiveStore.getRawState().stopping;
		const remoteTombstoneCount = remoteManifest.filter(
			(/** @type {import("./types").ManifestEntry} */ entry) => entry.deleted,
		).length;
		if (localDeletionSafe && remoteTombstoneCount > 0) {
			const localTrashResult = await dependencies.applyRemoteTombstones(
				localManifest,
				remoteManifest,
				localPath,
				canUpload,
				syncId,
			);
			localManifest = localTrashResult.manifest;
			hasChanges ||= localTrashResult.hasChanges;
			phaseComplete &&= localTrashResult.complete !== false;
		} else if (remoteTombstoneCount > 0) {
			dependencies.addSyncLog(
				"Local files retained because deletion safety checks did not pass",
				"warning",
			);
		}

		progress.setComplete();
		const duration = ((performance.now() - start) / 1000).toFixed(1);
		dependencies.addSyncLog(
			phaseComplete
				? `✓ ${name} sync complete (${remoteManifest.length} files) in ${duration}s`
				: `${name} sync incomplete; no destructive cleanup was performed`,
			phaseComplete ? "success" : "warning",
		);
		if (config.useChangeCounter) {
			const finalCounter = await dependencies.readLibraryCounter();
			dependencies.saveLibraryCounter(finalCounter);
			if (finalCounter !== initialLibraryCounter) {
				SyncActiveStore.update((state) => {
					state.libraryUpdateCounter = (state.libraryUpdateCounter || 0) + 1;
				});
			}
		}
		return {
			hasChanges,
			complete: phaseComplete && migrationComplete,
			newOffset: progress.getCurrentOffset(),
		};
	};
}

export const executeSyncPipeline = createSyncPipeline();
