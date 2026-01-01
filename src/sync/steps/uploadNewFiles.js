import storage from "@util/storage";
import { makePath } from "@util/path";
import { SYNC_BASE_PATH, LOCAL_SYNC_PATH, SYNC_BATCH_SIZE } from "../constants";
import { addSyncLog } from "../logs";
import { writeCompressedFile } from "../bundle";
import { getFileInfo } from "../hash";
import { applyManifestUpdates } from "../manifest";

/**
 * Helper function to upload a new file
 */
async function uploadNewFile(localFile, createdFolders) {
    const fileBasename = localFile.path;
    const localFilePath = makePath(LOCAL_SYNC_PATH, fileBasename);
    const remoteFilePath = makePath(SYNC_BASE_PATH, `${fileBasename}.gz`);

    try {
        const content = await storage.readFile(localFilePath);
        if (!content) return null;

        const data = JSON.parse(content);
        await writeCompressedFile(remoteFilePath, data, createdFolders);

        addSyncLog(`Uploaded new: ${fileBasename}`, "info");
        // Hash verification is already done locally, skip re-download
        return localFile;
    } catch (err) {
        console.error(`[Sync] Failed to upload new file ${fileBasename}:`, err);
        addSyncLog(`Failed to upload new: ${fileBasename}`, "error");
        return null;
    }
}

/**
 * Step 6: Upload new files not present in remote manifest
 * Uses parallel batch processing for performance
 */
export async function uploadNewFiles(localManifest, remoteManifest) {
    const start = performance.now();
    addSyncLog("Step 6: Uploading new files...", "info");

    try {
        const remoteMap = new Map(remoteManifest.map(f => [f.path, f]));
        const toUpload = [];
        const createdFolders = new Set();

        // Collect new files
        for (const localFile of localManifest) {
            if (!remoteMap.has(localFile.path)) {
                toUpload.push(localFile);
            }
        }

        if (toUpload.length === 0) {
            addSyncLog("✓ No new files to upload", "info");
            return { manifest: remoteManifest, hasChanges: false };
        }

        addSyncLog(`Uploading ${toUpload.length} new file(s)...`, "info");

        // Upload in parallel batches
        const updates = [];
        for (let i = 0; i < toUpload.length; i += SYNC_BATCH_SIZE) {
            const batch = toUpload.slice(i, i + SYNC_BATCH_SIZE);
            const progress = Math.min(i + batch.length, toUpload.length);
            const percent = Math.round((progress / toUpload.length) * 100);

            addSyncLog(`Uploading ${progress}/${toUpload.length} (${percent}%)...`, "info");

            const results = await Promise.all(
                batch.map(localFile => uploadNewFile(localFile, createdFolders))
            );

            updates.push(...results.filter(Boolean));
        }

        // Add all new files to remote manifest
        const updatedManifest = [...remoteManifest, ...updates];

        const duration = ((performance.now() - start) / 1000).toFixed(1);
        addSyncLog(`✓ Uploaded ${updates.length} new file(s) in ${duration}s`, updates.length > 0 ? "success" : "info");

        return { manifest: updatedManifest, hasChanges: updates.length > 0 };

    } catch (err) {
        console.error("[Sync] Upload new files failed:", err);
        addSyncLog(`Upload new files failed: ${err.message}`, "error");
        throw err;
    }
}
