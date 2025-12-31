import storage from "@util/storage";
import { makePath } from "@util/path";
import { SYNC_BASE_PATH, LOCAL_SYNC_PATH, FILES_MANIFEST, SYNC_BATCH_SIZE } from "../constants";
import { addSyncLog } from "../logs";
import { readCompressedFile } from "../bundle";
import { getFileInfo } from "../hash";
import { applyManifestUpdates } from "../manifest";

/**
 * Helper function to download a single file
 */
async function downloadFile(remoteFile) {
    const fileBasename = remoteFile.path;
    const localFilePath = makePath(LOCAL_SYNC_PATH, fileBasename);
    const remoteFilePath = makePath(SYNC_BASE_PATH, `${fileBasename}.gz`);

    try {
        const data = await readCompressedFile(remoteFilePath);
        if (!data) return null;

        await storage.createFolderPath(localFilePath);
        const content = JSON.stringify(data, null, 4);
        await storage.writeFile(localFilePath, content);

        // Verify hash
        const info = await getFileInfo(content);
        if (info.hash !== remoteFile.hash) {
            console.warn(`[Sync] Hash mismatch for ${fileBasename}. Remote: ${remoteFile.hash}, Local: ${info.hash}`);
        }

        return remoteFile;
    } catch (err) {
        console.error(`[Sync] Failed to download ${fileBasename}:`, err);
        return null;
    }
}

/**
 * Step 4: Download files that have higher version on remote
 * Uses parallel batch processing for performance
 */
export async function downloadUpdates(localManifest, remoteManifest) {
    const start = performance.now();
    addSyncLog("Step 4: Downloading updates...", "info");

    try {
        const localMap = new Map(localManifest.map(f => [f.path, f]));
        const toDownload = [];

        // Collect files that need downloading
        for (const remoteFile of remoteManifest) {
            const localFile = localMap.get(remoteFile.path);
            const remoteVer = parseInt(remoteFile.version);
            const localVer = localFile ? parseInt(localFile.version) : 0;

            if (remoteVer > localVer) {
                toDownload.push(remoteFile);
            }
        }

        if (toDownload.length === 0) {
            addSyncLog("✓ No downloads needed", "info");
            return { manifest: localManifest, hasChanges: false };
        }

        addSyncLog(`Downloading ${toDownload.length} file(s)...`, "info");

        // Download in parallel batches
        const updates = [];
        for (let i = 0; i < toDownload.length; i += SYNC_BATCH_SIZE) {
            const batch = toDownload.slice(i, i + SYNC_BATCH_SIZE);
            const progress = Math.min(i + batch.length, toDownload.length);
            const percent = Math.round((progress / toDownload.length) * 100);

            addSyncLog(`Downloading ${progress}/${toDownload.length} (${percent}%)...`, "info");

            const results = await Promise.all(
                batch.map(remoteFile => downloadFile(remoteFile))
            );

            updates.push(...results.filter(Boolean));
        }

        // Apply all updates in a single operation
        const updatedManifest = await applyManifestUpdates(localManifest, updates);

        // Write updated manifest to disk
        const manifestPath = makePath(LOCAL_SYNC_PATH, FILES_MANIFEST);
        await storage.writeFile(manifestPath, JSON.stringify(updatedManifest, null, 4));

        const duration = ((performance.now() - start) / 1000).toFixed(1);
        addSyncLog(`✓ Downloaded ${updates.length} file(s) in ${duration}s`, updates.length > 0 ? "success" : "info");

        return { manifest: updatedManifest, hasChanges: updates.length > 0 };

    } catch (err) {
        console.error("[Sync] Download failed:", err);
        addSyncLog(`Download failed: ${err.message}`, "error");
        throw err;
    }
}
