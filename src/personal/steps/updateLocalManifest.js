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
        let existingManifest = {};

        // Read existing manifest to avoid recalculating hashes for unchanged files
        try {
            const content = await storage.readFile(manifestPath);
            const parsed = JSON.parse(content);
            if (parsed && typeof parsed === 'object') {
                // Normalize paths in existing manifest (strip leading slashes from old entries)
                for (const [path, entry] of Object.entries(parsed)) {
                    const normalizedPath = path.startsWith("/") ? path.substring(1) : path;
                    existingManifest[normalizedPath] = entry;
                }
            }
        } catch (err) {
            addSyncLog("[Personal] No existing manifest found, creating new one", "info");
        }

        // Build new manifest from current files only
        const manifest = {};
        for (const file of localFiles) {
            const content = await storage.readFile(file.fullPath);
            const hash = await calculateHash(content);

            manifest[file.path] = {
                hash,
                modified: Date.now()
            };
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
