import { logger as structuredLogger } from "@util/api/logger";
import { isBinaryFile, makePath } from "@util/data/path";
import storage from "@util/storage/storage";
import Cookies from "js-cookie";
import { writeCompressedFile } from "../bundle";
import { LOCAL_SYNC_PATH, SYNC_BASE_PATH, SYNC_BATCH_SIZE } from "../constants";
import { addSyncLog } from "../logs";
import { SyncActiveStore } from "../syncState";

/**
 * Helper function to upload a new file
 */
async function uploadNewFile(localFile, createdFolders, localPath, remotePath) {
	const fileBasename = localFile.path;
	const localFilePath = makePath(localPath, fileBasename);
	const isBinary = isBinaryFile(localFilePath);
	// Don't add .gz extension for binary files - they're already compressed or should stay as-is
	const remoteFilePath = isBinary
		? makePath(remotePath, fileBasename)
		: makePath(remotePath, `${fileBasename}.gz`);

	try {
		const content = await storage.readFile(localFilePath);
		if (!content) return null;

		if (isBinary) {
			// Binary files: write directly without additional compression
			// Content is already in the correct format (base64 string or Uint8Array)
			await storage.createFolderPath(remoteFilePath);
			await storage.writeFile(remoteFilePath, content);
		} else {
			// Non-binary files: parse as JSON and compress
			const data = JSON.parse(content);
			await writeCompressedFile(remoteFilePath, data, createdFolders);
		}

		addSyncLog(`Uploaded new: ${makePath(remotePath, fileBasename)}`, "info");
		// Hash verification is already done locally, skip re-download
		return localFile;
	} catch (err) {
		structuredLogger.error(
			`[Sync] Failed to upload new file ${fileBasename}:`,
			err,
		);
		addSyncLog(`Failed to upload new: ${fileBasename}`, "error");
		return null;
	}
}

/**
 * Step 6: Upload new files not present in remote manifest
 * Uses parallel batch processing for performance
 */
export async function uploadNewFiles(
	localManifest,
	remoteManifest,
	localPath = LOCAL_SYNC_PATH,
	remotePath = SYNC_BASE_PATH,
	progressTracker = null,
) {
	const start = performance.now();
	addSyncLog("Step 6: Uploading new files...", "info");

	try {
		const remoteMap = new Map((remoteManifest || []).map((f) => [f.path, f]));
		const toUpload = [];
		const createdFolders = new Set();

		// Collect new files
		for (const localFile of localManifest) {
			if (localFile.deleted) continue;
			if (!remoteMap.has(localFile.path)) {
				toUpload.push(localFile);
			}
		}

		if (toUpload.length === 0) {
			addSyncLog("✓ No new files to upload", "info");
			return {
				manifest: remoteManifest,
				hasChanges: false,
				complete: true,
				counts: { attempted: 0, succeeded: 0, failed: 0 },
			};
		}

		addSyncLog(`Uploading ${toUpload.length} new file(s)...`, "info");

		if (progressTracker) {
			progressTracker.updateProgress("uploadNewFiles", {
				processed: 0,
				total: toUpload.length,
			});
		}

		// Upload in parallel batches
		const updates = [];
		for (let i = 0; i < toUpload.length; i += SYNC_BATCH_SIZE) {
			// Check for cancellation
			if (SyncActiveStore.getRawState().stopping) {
				addSyncLog("Upload stopped by user", "warning");
				break;
			}
			const batch = toUpload.slice(i, i + SYNC_BATCH_SIZE);
			const progress = Math.min(i + batch.length, toUpload.length);
			const percent = Math.round((progress / toUpload.length) * 100);

			addSyncLog(
				`Uploading ${progress}/${toUpload.length} (${percent}%)...`,
				"info",
			);

			if (progressTracker) {
				progressTracker.updateProgress("uploadNewFiles", {
					processed: progress,
					total: toUpload.length,
				});
			}

			const results = await Promise.all(
				batch.map((localFile) =>
					uploadNewFile(localFile, createdFolders, localPath, remotePath),
				),
			);

			updates.push(...results.filter(Boolean));
		}

		// Keep the version that was already generated locally
		const validUpdates = updates.filter((f) => f && f.path);
		const updatedManifest = [...remoteManifest, ...validUpdates];

		const duration = ((performance.now() - start) / 1000).toFixed(1);
		addSyncLog(
			`✓ Uploaded ${updates.length} new file(s) in ${duration}s`,
			updates.length > 0 ? "success" : "info",
		);

		return {
			manifest: updatedManifest,
			hasChanges: updates.length > 0,
			complete:
				updates.length === toUpload.length &&
				!SyncActiveStore.getRawState().stopping,
			counts: {
				attempted: toUpload.length,
				succeeded: updates.length,
				failed: toUpload.length - updates.length,
			},
		};
	} catch (err) {
		if (
			err.status === 403 ||
			err === 403 ||
			err.message?.includes("ACCESS_DENIED")
		) {
			const role = Cookies.get("role");
			if (role === "visitor") {
				addSyncLog(
					"Visitor access restricted. Please contact Administrator for write access.",
					"warning",
				);
			} else {
				addSyncLog("Skipping new files upload (read-only access)", "warning");
			}
			return {
				manifest: remoteManifest,
				hasChanges: false,
				complete: false,
				counts: { attempted: 0, succeeded: 0, failed: 1 },
			};
		}
		structuredLogger.error("[Sync] Upload new files failed:", err);
		addSyncLog(`Upload new files failed: ${err.message}`, "error");
		throw err;
	}
}
