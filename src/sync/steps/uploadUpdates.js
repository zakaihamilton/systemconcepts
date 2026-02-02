import storage from "@util/storage";
import { makePath, isBinaryFile } from "@util/path";
import { SYNC_BATCH_SIZE, LOCAL_SYNC_PATH, SYNC_BASE_PATH } from "../constants";
import { addSyncLog } from "../logs";
import { writeCompressedFile } from "../bundle";
import Cookies from "js-cookie";
import { applyManifestUpdates } from "../manifest";
import { lockMutex } from "../mutex";
import { SyncActiveStore } from "../syncState";

/**
 * Helper function to upload a single file
 */
async function uploadFile(localFile, createdFolders, localPath, remotePath) {
    const fileBasename = localFile.path;
    const localFilePath = makePath(localPath, fileBasename);
    const remoteFilePath = makePath(remotePath, `${fileBasename}.gz`);

    try {
        const unlock = await lockMutex({ id: localFilePath });
        let content;
        try {
            content = await storage.readFile(localFilePath);
        } finally {
            unlock();
        }
        if (!content) return null;

        let data = content;
        if (!isBinaryFile(localFilePath)) {
            data = JSON.parse(content);
        }
        await writeCompressedFile(remoteFilePath, data, createdFolders);

        addSyncLog(`Uploaded: ${makePath(remotePath, fileBasename)}`, "info");
        // Hash verification is already done locally, skip re-download
        return localFile;
    } catch (err) {
        console.error(`[Sync] Failed to upload ${fileBasename}:`, err);
        addSyncLog(`Failed to upload: ${fileBasename}`, "error");
        return null;
    }
}

/**
 * Step 5: Upload files that have higher version locally
 * Uses parallel batch processing for performance
 */
export async function uploadUpdates(localManifest, remoteManifest, localPath = LOCAL_SYNC_PATH, remotePath = SYNC_BASE_PATH, progressTracker = null) {
    const start = performance.now();
    addSyncLog("Step 5: Uploading updates...", "info");

    try {
        const remoteMap = new Map((remoteManifest || []).map(f => [f.path, f]));
        const toUpload = [];
        const createdFolders = new Set();

        // Collect files that need uploading
        for (const localFile of localManifest) {
            const remoteFile = remoteMap.get(localFile.path);
            const localVer = parseInt(localFile.version);
            const remoteVer = remoteFile ? parseInt(remoteFile.version) : 0;

            if (remoteFile && localVer > remoteVer) {
                toUpload.push(localFile);
            }
        }

        if (toUpload.length === 0) {
            addSyncLog("✓ No uploads needed", "info");
            return { manifest: remoteManifest, hasChanges: false };
        }

        addSyncLog(`Uploading ${toUpload.length} update(s)...`, "info");

        if (progressTracker) {
            progressTracker.updateProgress('uploadUpdates', { processed: 0, total: toUpload.length });
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

            addSyncLog(`Uploading ${progress}/${toUpload.length} (${percent}%)...`, "info");

            if (progressTracker) {
                progressTracker.updateProgress('uploadUpdates', { processed: progress, total: toUpload.length });
            }

            const results = await Promise.all(
                batch.map(localFile => uploadFile(localFile, createdFolders, localPath, remotePath))
            );

            updates.push(...results.filter(Boolean));
        }

        // Apply all updates to remote manifest
        const validUpdates = updates.filter(f => f && f.path);
        const updatedManifest = await applyManifestUpdates(remoteManifest, validUpdates);

        const duration = ((performance.now() - start) / 1000).toFixed(1);
        addSyncLog(`✓ Uploaded ${updates.length} update(s) in ${duration}s`, updates.length > 0 ? "success" : "info");

        return { manifest: updatedManifest, hasChanges: updates.length > 0 };

    } catch (err) {
        if (err.status === 403 || err === 403 || err.message?.includes("ACCESS_DENIED")) {
            const role = Cookies.get("role");
            if (role === "visitor") {
                addSyncLog("Visitor access restricted. Please contact Administrator for write access.", "warning");
            } else {
                addSyncLog("Skipping updates upload (read-only access)", "warning");
            }
            return { manifest: remoteManifest, hasChanges: false };
        }
        console.error("[Sync] Upload updates failed:", err);
        addSyncLog(`Upload updates failed: ${err.message}`, "error");
        throw err;
    }
}
