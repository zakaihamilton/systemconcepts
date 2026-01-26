import storage from "@util/storage";
import { makePath } from "@util/path";
import { LOCAL_SYNC_PATH, FILES_MANIFEST, SYNC_BATCH_SIZE } from "../constants";
import { addSyncLog } from "../logs";
import { SyncActiveStore } from "../syncState";
import { getFileInfo } from "../hash";
import { lockMutex } from "../mutex";

/**
 * Helper function to compute file info for a single file
 */
async function computeFileInfo(file) {
    try {
        // Optimization: Check if file needs re-hashing
        if (file.file && file.info && file.skipHash) {
            return { file: file.file, info: file.info };
        }

        const unlock = await lockMutex({ id: file.fullPath });
        let content;
        try {
            content = await storage.readFile(file.fullPath);
        } finally {
            unlock();
        }

        if (content === undefined || content === null) {
            return null;
        }
        const info = await getFileInfo(content);
        return { file, info };
    } catch (err) {
        console.error(`[Sync] Error reading ${file.path}:`, err);
        return null;
    }
}

/**
 * Step 2: Update local manifest with file hashes
 * Uses parallel batch processing for performance
 */
export async function updateLocalManifest(localFiles, localPath = LOCAL_SYNC_PATH, remoteManifest = []) {
    const start = performance.now();
    addSyncLog("Step 2: Updating local manifest...", "info");

    const localManifestPath = makePath(localPath, FILES_MANIFEST);
    const remoteManifestMap = new Map(remoteManifest.map(f => [f.path, f]));

    try {
        let manifest = [];
        if (await storage.exists(localManifestPath)) {
            const content = await storage.readFile(localManifestPath);
            if (content) {
                try {
                    manifest = JSON.parse(content);
                } catch (err) {
                    console.error("[Sync] Failed to parse manifest, starting fresh", err);
                }
            }
        }

        // Create a map for faster lookup
        const manifestMap = new Map(manifest.map(f => [f.path, f]));

        // Compute file info in parallel batches
        addSyncLog(`Computing hashes for ${localFiles.length} file(s)...`, "info");
        const fileInfos = [];

        SyncActiveStore.update(s => {
            s.progress = { total: localFiles.length, processed: 0 };
        });

        for (let i = 0; i < localFiles.length; i += SYNC_BATCH_SIZE) {
            const batch = localFiles.slice(i, i + SYNC_BATCH_SIZE);
            const progress = Math.min(i + batch.length, localFiles.length);
            const percent = Math.round((progress / localFiles.length) * 100);

            addSyncLog(`Computing hashes ${progress}/${localFiles.length} (${percent}%)...`, "info");

            SyncActiveStore.update(s => {
                s.progress = { total: localFiles.length, processed: progress };
            });

            const results = await Promise.all(
                batch.map(file => {
                    // Check if we can skip hashing
                    const existingEntry = manifestMap.get(file.path);
                    if (existingEntry &&
                        existingEntry.mtime &&
                        file.mtime &&
                        Math.abs(existingEntry.mtime - file.mtime) < 1000 && // Tolerance for FS timing diffs
                        existingEntry.size === file.size
                    ) {
                        // File hasn't changed, reuse existing info
                        return Promise.resolve({
                            file,
                            info: {
                                hash: existingEntry.hash,
                                size: existingEntry.size
                            },
                            skipHash: true
                        });
                    }
                    // Otherwise compute
                    return computeFileInfo(file);
                })
            );

            fileInfos.push(...results.filter(Boolean));
        }

        let changed = false;

        // Update manifest with computed info
        for (const { file, info } of fileInfos) {
            if (!manifestMap.has(file.path)) {
                // New file
                const remoteEntry = remoteManifestMap.get(file.path);
                const remoteVer = remoteEntry ? (parseInt(remoteEntry.version) || 0) : 0;
                const newVer = remoteVer + 1;

                const newEntry = {
                    path: file.path,
                    hash: info.hash,
                    size: info.size,
                    mtime: file.mtime, // Store mtime
                    version: newVer.toString()
                };
                manifest.push(newEntry);
                manifestMap.set(file.path, newEntry);
                changed = true;
                console.log(`[Sync] Added new file to manifest: ${file.path}`);
            } else {
                // Existing file - check if modified
                const existingEntry = manifestMap.get(file.path);
                if (existingEntry.hash !== info.hash) {
                    const localVer = parseInt(existingEntry.version) || 0;
                    const remoteEntry = remoteManifestMap.get(file.path);
                    const remoteVer = remoteEntry ? (parseInt(remoteEntry.version) || 0) : 0;
                    const newVer = Math.max(localVer, remoteVer) + 1;

                    existingEntry.hash = info.hash;
                    existingEntry.size = info.size;
                    existingEntry.mtime = file.mtime; // Update mtime
                    existingEntry.version = newVer.toString();
                    changed = true;
                    console.log(`[Sync] Updated file in manifest (version incremented to ${newVer}): ${file.path}`);
                }
            }
        }

        // Mark files as deleted in manifest if they no longer exist locally
        const localFilePaths = new Set(localFiles.map(f => f.path));
        manifest.forEach(f => {
            if (!localFilePaths.has(f.path)) {
                if (!f.deleted) {
                    console.log(`[Sync] Marking missing file as deleted in manifest: ${f.path}`);
                    f.deleted = true;
                    changed = true;
                }
            } else if (f.deleted) {
                console.log(`[Sync] File restored locally, unmarking deleted: ${f.path}`);
                delete f.deleted;
                changed = true;
            }
        });

        if (changed || !(await storage.exists(localManifestPath))) {
            const unlock = await lockMutex({ id: localManifestPath });
            try {
                await storage.writeFile(localManifestPath, JSON.stringify(manifest, null, 4));
            } finally {
                unlock();
            }
        }

        const duration = ((performance.now() - start) / 1000).toFixed(1);
        addSyncLog(`✓ Updated manifest in ${duration}s (${manifest.length} files)`, "info");
        return manifest;

    } catch (err) {
        console.error("[Sync] Step 2 error:", err);
        addSyncLog(`Step 2 failed: ${err.message}`, "error");
        throw err;
    }
}
