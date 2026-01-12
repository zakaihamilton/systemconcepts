import storage from "@util/storage";
import { makePath } from "@util/path";
import { LOCAL_SYNC_PATH, FILES_MANIFEST, SYNC_BATCH_SIZE } from "../constants";
import { addSyncLog } from "../logs";
import { SyncActiveStore } from "../syncState";
import { getFileInfo } from "../hash";

/**
 * Helper function to compute file info for a single file
 */
async function computeFileInfo(file) {
    try {
        const content = await storage.readFile(file.fullPath);
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
export async function updateLocalManifest(localFiles) {
    const start = performance.now();
    addSyncLog("Step 2: Updating local manifest...", "info");

    const localManifestPath = makePath(LOCAL_SYNC_PATH, FILES_MANIFEST);

    try {
        let manifest = [];
        if (await storage.exists(localManifestPath)) {
            const content = await storage.readFile(localManifestPath);
            manifest = JSON.parse(content);
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
                batch.map(file => computeFileInfo(file))
            );

            fileInfos.push(...results.filter(Boolean));
        }

        let changed = false;

        // Update manifest with computed info
        for (const { file, info } of fileInfos) {
            if (!manifestMap.has(file.path)) {
                // New file
                const newEntry = {
                    path: file.path,
                    hash: info.hash,
                    size: info.size,
                    version: "1"
                };
                manifest.push(newEntry);
                manifestMap.set(file.path, newEntry);
                changed = true;
                console.log(`[Sync] Added new file to manifest: ${file.path}`);
            } else {
                // Existing file - check if modified
                const existingEntry = manifestMap.get(file.path);
                if (existingEntry.hash !== info.hash) {
                    existingEntry.hash = info.hash;
                    existingEntry.size = info.size;
                    existingEntry.version = (parseInt(existingEntry.version) + 1).toString();
                    changed = true;
                    console.log(`[Sync] Updated file in manifest (version incremented): ${file.path}`);
                }
            }
        }

        // Remove files from manifest that no longer exist locally
        const localFilePaths = new Set(localFiles.map(f => f.path));
        const filteredManifest = manifest.filter(f => {
            if (!localFilePaths.has(f.path)) {
                console.log(`[Sync] Removing missing file from manifest: ${f.path}`);
                changed = true;
                return false;
            }
            return true;
        });

        if (changed) {
            await storage.writeFile(localManifestPath, JSON.stringify(filteredManifest, null, 4));
        }

        const duration = ((performance.now() - start) / 1000).toFixed(1);
        addSyncLog(`✓ Updated manifest in ${duration}s (${filteredManifest.length} files)`, "info");
        return filteredManifest;

    } catch (err) {
        console.error("[Sync] Step 2 error:", err);
        addSyncLog(`Step 2 failed: ${err.message}`, "error");
        throw err;
    }
}
