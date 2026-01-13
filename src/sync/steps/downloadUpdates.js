import storage from "@util/storage";
import { makePath } from "@util/path";
import { SYNC_BASE_PATH, LOCAL_SYNC_PATH, FILES_MANIFEST, FILES_MANIFEST_GZ, SYNC_BATCH_SIZE } from "../constants";
import { addSyncLog } from "../logs";
import { readCompressedFile, writeCompressedFile } from "../bundle";
import { getFileInfo } from "../hash";
import { applyManifestUpdates } from "../manifest";
import { SyncActiveStore } from "../syncState";

/**
 * Helper function to download a single file
 */
async function downloadFile(remoteFile, createdFolders, localPath, remotePath) {
    const fileBasename = remoteFile.path;
    const localFilePath = makePath(localPath, fileBasename);
    let remoteFilePath = makePath(remotePath, `${fileBasename}.gz`);

    try {
        let data = await readCompressedFile(remoteFilePath);

        if (!data) {
            // Try without .gz extension
            remoteFilePath = makePath(remotePath, fileBasename);
            data = await readCompressedFile(remoteFilePath);
        }

        if (!data) return null;

        if (createdFolders) {
            const folder = localFilePath.substring(0, localFilePath.lastIndexOf("/"));
            if (!createdFolders.has(folder)) {
                await storage.createFolderPath(localFilePath);
                createdFolders.add(folder);
            }
        } else {
            await storage.createFolderPath(localFilePath);
        }
        const content = JSON.stringify(data, null, 4);
        await storage.writeFile(localFilePath, content);

        // Verify hash
        if (remoteFile.hash) {
            const info = await getFileInfo(content);
            if (info.hash !== remoteFile.hash) {
                console.warn(`[Sync] Hash mismatch for ${fileBasename}. Remote: ${remoteFile.hash}, Local: ${info.hash}`);
            }
        }

        addSyncLog(`Downloaded: ${fileBasename}`, "info");
        return remoteFile;
    } catch (err) {
        console.error(`[Sync] Failed to download ${fileBasename}:`, err);
        addSyncLog(`Failed to download: ${fileBasename}`, "error");
        return null;
    }
}

/**
 * Step 4: Download files that have higher version on remote
 * Uses parallel batch processing for performance
 */
export async function downloadUpdates(localManifest, remoteManifest, localPath = LOCAL_SYNC_PATH, remotePath = SYNC_BASE_PATH) {
    const start = performance.now();
    addSyncLog("Step 4: Downloading updates...", "info");

    try {
        const localMap = new Map(localManifest.map(f => [f.path, f]));
        const toDownload = [];
        const createdFolders = new Set();
        const missingOnRemote = [];

        // Collect files that need downloading
        for (const remoteFile of remoteManifest) {
            const localFile = localMap.get(remoteFile.path);
            const remoteVer = parseInt(remoteFile.version) || 0;
            const localVer = localFile ? (parseInt(localFile.version) || 0) : 0;

            console.log(`[Sync] Check ${remoteFile.path}: remoteVer=${remoteVer}, localVer=${localVer}`);

            if (remoteVer > localVer || !localFile) {
                toDownload.push(remoteFile);
            }
        }

        if (toDownload.length === 0) {
            console.log("[Sync] Comparison complete, nothing to download. Remote Manifest:", JSON.stringify(remoteManifest));
            return { manifest: localManifest, hasChanges: false, cleanedRemoteManifest: remoteManifest };
        }

        addSyncLog(`Downloading ${toDownload.length} file(s)...`, "info");

        SyncActiveStore.update(s => {
            s.progress = { total: toDownload.length, processed: 0 };
        });

        // Download in parallel batches
        const updates = [];
        for (let i = 0; i < toDownload.length; i += SYNC_BATCH_SIZE) {
            const batch = toDownload.slice(i, i + SYNC_BATCH_SIZE);
            const progress = Math.min(i + batch.length, toDownload.length);
            const percent = Math.round((progress / toDownload.length) * 100);

            addSyncLog(`Downloading ${progress}/${toDownload.length} (${percent}%)...`, "info");

            SyncActiveStore.update(s => {
                s.progress = { total: toDownload.length, processed: progress };
            });

            const results = await Promise.all(
                batch.map(async remoteFile => {
                    const result = await downloadFile(remoteFile, createdFolders, localPath, remotePath);
                    // If download returned null, the file doesn't exist on remote
                    if (result === null) {
                        missingOnRemote.push(remoteFile);
                    }
                    return result;
                })
            );

            updates.push(...results.filter(Boolean));
        }

        // Clean remote manifest if we found missing files
        let cleanedRemoteManifest = remoteManifest;
        if (missingOnRemote.length > 0) {
            addSyncLog(`Found ${missingOnRemote.length} missing file(s) on remote, cleaning manifest...`, "info");

            const missingPaths = new Set(missingOnRemote.map(f => f.path));
            cleanedRemoteManifest = remoteManifest.filter(f => !missingPaths.has(f.path));

            // Log each missing file
            missingOnRemote.forEach(file => {
                addSyncLog(`Removed from remote manifest: ${file.path} (file not found)`, "info");
            });

            // Upload the cleaned manifest immediately
            const manifestPath = makePath(remotePath, FILES_MANIFEST_GZ);
            await writeCompressedFile(manifestPath, cleanedRemoteManifest);
            addSyncLog(`✓ Cleaned remote manifest (removed ${missingOnRemote.length} missing files)`, "success");
        }

        // Apply all updates in a single operation
        const updatedManifest = await applyManifestUpdates(localManifest, updates);

        // Write updated manifest to disk
        const manifestPath = makePath(localPath, FILES_MANIFEST);
        await storage.writeFile(manifestPath, JSON.stringify(updatedManifest, null, 4));

        const duration = ((performance.now() - start) / 1000).toFixed(1);
        addSyncLog(`✓ Downloaded ${updates.length} file(s) in ${duration}s`, updates.length > 0 ? "success" : "info");

        return { manifest: updatedManifest, hasChanges: updates.length > 0, cleanedRemoteManifest };

    } catch (err) {
        console.error("[Sync] Download failed:", err);
        addSyncLog(`Download failed: ${err.message}`, "error");
        throw err;
    }
}
