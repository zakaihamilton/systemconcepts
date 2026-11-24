import { logger as structuredLogger } from "@util/api/logger";
import { makePath } from "@util/data/path";
import storage from "@util/storage/storage";
import {
	FILES_MANIFEST,
	LOCAL_SYNC_PATH,
	SYNC_BASE_PATH,
	SYNC_BATCH_SIZE,
} from "../constants";
import { addSyncLog } from "../logs";
import { applyManifestUpdates } from "../manifest";
import { lockMutex } from "../mutex";
import type { SyncProgressTracker } from "../progressTracker";
import { SyncActiveStore } from "../syncState";
import { downloadSingleFile } from "./download/downloadSingleFile";
import {
	cleanMissingRemoteManifest,
	planDownloads,
} from "./download/planDownloads";

async function writeLocalManifest(localPath: string, updatedManifest: any) {
	const manifestPath = makePath(localPath, FILES_MANIFEST);
	const unlock = await lockMutex({ id: manifestPath });
	try {
		await storage.writeFile(
			manifestPath,
			JSON.stringify(updatedManifest, null, 4),
		);
	} finally {
		unlock();
	}
}

/**
 * Step 4: Download files that have higher version on remote
 * Uses parallel batch processing for performance
 */
export async function downloadUpdates(
	localManifest: any,
	remoteManifest: any,
	localPath = LOCAL_SYNC_PATH,
	remotePath = SYNC_BASE_PATH,
	canUpload = true,
	progressTracker: Pick<SyncProgressTracker, "updateProgress"> | null = null,
	restoreMissingFiles = false,
) {
	const start = performance.now();
	addSyncLog("Step 4: Downloading updates...", "info");

	try {
		const { localMap, toDownload, updates } = planDownloads(
			localManifest,
			remoteManifest,
			canUpload,
			restoreMissingFiles,
		);
		const createdFolders = new Set<any>();
		const missingOnRemote: any = [];
		const failedDownloads: any[] = [];
		let processedDownloads = 0;

		if (toDownload.length === 0) {
			structuredLogger.debug(
				"[Sync] Comparison complete, nothing to download. Remote Manifest:",
				JSON.stringify(remoteManifest),
			);
			const updatedManifest = await applyManifestUpdates(
				localManifest,
				updates,
			);
			if (updates.length > 0) {
				await writeLocalManifest(localPath, updatedManifest);
			}
			return {
				manifest: updatedManifest,
				hasChanges: false,
				complete: true,
				counts: { attempted: 0, succeeded: 0, failed: 0 },
				cleanedRemoteManifest: remoteManifest,
			};
		}

		addSyncLog(`Downloading ${toDownload.length} file(s)...`, "info");

		if (progressTracker) {
			progressTracker.updateProgress("downloadUpdates", {
				processed: 0,
				total: toDownload.length,
			});
		}

		for (let i = 0; i < toDownload.length; i += SYNC_BATCH_SIZE) {
			if (SyncActiveStore.getRawState().stopping) {
				addSyncLog("Download stopped by user", "warning");
				break;
			}
			const batch = toDownload.slice(i, i + SYNC_BATCH_SIZE);
			const progress = Math.min(i + batch.length, toDownload.length);
			const percent = Math.round((progress / toDownload.length) * 100);

			addSyncLog(
				`Downloading ${progress}/${toDownload.length} (${percent}%)...`,
				"info",
			);

			if (progressTracker) {
				progressTracker.updateProgress("downloadUpdates", {
					processed: progress,
					total: toDownload.length,
				});
			}

			const results = await Promise.all(
				batch.map(async (remoteFile) => {
					const localEntry = localMap.get(remoteFile.path);
					const result = await downloadSingleFile(
						remoteFile,
						localEntry,
						createdFolders,
						localPath,
						remotePath,
					);
					if (result === null) {
						missingOnRemote.push(remoteFile);
					} else if (result.failed) {
						failedDownloads.push(remoteFile);
					}
					return result;
				}),
			);
			processedDownloads += batch.length;

			updates.push(...results.filter((result) => result && !result.failed));
		}

		const cleanedRemoteManifest = cleanMissingRemoteManifest(
			remoteManifest,
			missingOnRemote,
			SyncActiveStore.getRawState().stopping,
		);

		const updatedManifest = await applyManifestUpdates(localManifest, updates);
		const failedCount = missingOnRemote.length + failedDownloads.length;
		const unprocessedCount = toDownload.length - processedDownloads;

		await writeLocalManifest(localPath, updatedManifest);

		const duration = ((performance.now() - start) / 1000).toFixed(1);
		addSyncLog(
			`✓ Downloaded ${updates.length} file(s) in ${duration}s`,
			updates.length > 0 ? "success" : "info",
		);
		if (failedCount + unprocessedCount > 0) {
			addSyncLog(
				`${failedCount + unprocessedCount} file(s) were not downloaded and will be retried`,
				"warning",
			);
		}

		return {
			manifest: updatedManifest,
			hasChanges: updates.length > 0,
			complete:
				failedCount === 0 &&
				unprocessedCount === 0 &&
				!SyncActiveStore.getRawState().stopping,
			counts: {
				attempted: processedDownloads,
				succeeded: processedDownloads - failedCount,
				failed: failedCount + unprocessedCount,
			},
			cleanedRemoteManifest,
		};
	} catch (err: any) {
		structuredLogger.error("[Sync] Download failed:", err);
		addSyncLog(`Download failed: ${err.message}`, "error");
		throw err;
	}
}
