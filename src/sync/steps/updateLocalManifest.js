import storage from "@util/storage";
import { makePath } from "@util/path";
import { LOCAL_SYNC_PATH, FILES_MANIFEST } from "../constants";
import { addSyncLog } from "../logs";
import { getFileInfo } from "../hash";

/**
 * Step 2: If a local file exists that does not exist in the listing, add it to the files.json with a version of 1
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

        let changed = false;

        // Create a map for faster lookup
        const manifestMap = new Map(manifest.map(f => [f.path, f]));

        for (const file of localFiles) {
            // Read file info
            const content = await storage.readFile(file.fullPath);
            const info = await getFileInfo(content);

            // Check if file is in manifest
            if (!manifestMap.has(file.path)) {
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
                // File exists, check if modified
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

        // Also remove files from manifest that no longer exist locally
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

        const duration = (performance.now() - start).toFixed(1);
        console.log(`[Sync] Step 2 finished in ${duration}ms. Manifest size: ${filteredManifest.length}`);
        return filteredManifest;
    } catch (err) {
        console.error("[Sync] Step 2 error:", err);
        throw err;
    }
}
