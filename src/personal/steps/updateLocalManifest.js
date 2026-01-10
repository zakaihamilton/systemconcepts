import storage from "@util/storage";
import { LOCAL_PERSONAL_PATH, LOCAL_PERSONAL_MANIFEST } from "../constants";
import { addSyncLog } from "@sync/logs";
import { calculateHash } from "@sync/hash";

/**
 * Step 2: Update the local manifest with current file hashes
 */
export async function updateLocalManifest(localFiles) {
    const start = performance.now();
    addSyncLog("[Personal] Step 2: Updating local manifest...", "info");

    try {
        const manifestPath = `${LOCAL_PERSONAL_PATH}/${LOCAL_PERSONAL_MANIFEST}`;
        let manifest = {};

        // Try to read existing manifest
        try {
            const content = await storage.readFile(manifestPath);
            const existingManifest = JSON.parse(content);
            if (existingManifest && typeof existingManifest === 'object') {
                manifest = existingManifest;
            }
        } catch (err) {
            addSyncLog("[Personal] No existing manifest found, creating new one", "info");
        }

        // Update manifest with current files
        for (const file of localFiles) {
            const content = await storage.readFile(file.fullPath);
            const hash = await calculateHash(content);


            if (!manifest[file.path] || manifest[file.path].hash !== hash) {
                manifest[file.path] = {
                    hash,
                    modified: Date.now()
                };
            }
        }

        // Write updated manifest
        await storage.createFolderPath(manifestPath);
        await storage.writeFile(manifestPath, JSON.stringify(manifest, null, 4));

        const duration = ((performance.now() - start) / 1000).toFixed(1);
        addSyncLog(`[Personal] ✓ Updated local manifest with ${Object.keys(manifest).length} file(s) in ${duration}s`, "info");
        return manifest;
    } catch (err) {
        console.error("[Personal Sync] Step 2 error:", err);
        throw err;
    }
}
