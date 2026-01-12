import storage from "@util/storage";
import { makePath } from "@util/path";
import { SYNC_BASE_PATH, LOCAL_SYNC_PATH, SYNC_BATCH_SIZE } from "../constants";
import { addSyncLog } from "../logs";
import { SyncActiveStore } from "../syncState";
import { writeCompressedFile } from "../bundle";
import { getFileInfo } from "../hash";
import { applyManifestUpdates } from "../manifest";

/**
 * Helper function to upload a single file
 */
async function uploadFile(localFile, createdFolders) {
    const fileBasename = localFile.path;
    const localFilePath = makePath(LOCAL_SYNC_PATH, fileBasename);
    const remoteFilePath = makePath(SYNC_BASE_PATH, `${fileBasename}.gz`);

    try {
        const content = await storage.readFile(localFilePath);
        if (!content) return null;

        const data = JSON.parse(content);
        await writeCompressedFile(remoteFilePath, data, createdFolders);

        addSyncLog(`Uploaded: ${fileBasename}`, "info");
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
export async function uploadUpdates(localManifest, remoteManifest) {
    const start = performance.now();
    addSyncLog("Step 5: Uploading updates...", "info");

    try {
        const remoteMap = new Map(remoteManifest.map(f => [f.path, f]));
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

        SyncActiveStore.update(s => {
            s.progress = { total: toUpload.length, processed: 0 };
        });

        // Upload in parallel batches
        const updates = [];
        for (let i = 0; i < toUpload.length; i += SYNC_BATCH_SIZE) {
            const batch = toUpload.slice(i, i + SYNC_BATCH_SIZE);
            const progress = Math.min(i + batch.length, toUpload.length);
            const percent = Math.round((progress / toUpload.length) * 100);

            addSyncLog(`Uploading ${progress}/${toUpload.length} (${percent}%)...`, "info");

            SyncActiveStore.update(s => {
                s.progress = { total: toUpload.length, processed: progress };
            });

            const results = await Promise.all(
                batch.map(localFile => uploadFile(localFile, createdFolders))
            );

            updates.push(...results.filter(Boolean));
        }

        // Apply all updates to remote manifest
        const updatedManifest = await applyManifestUpdates(remoteManifest, updates);

        const duration = ((performance.now() - start) / 1000).toFixed(1);
        addSyncLog(`✓ Uploaded ${updates.length} update(s) in ${duration}s`, updates.length > 0 ? "success" : "info");

        return { manifest: updatedManifest, hasChanges: updates.length > 0 };

    } catch (err) {
        console.error("[Sync] Upload updates failed:", err);
        addSyncLog(`Upload updates failed: ${err.message}`, "error");
        throw err;
    }
}
