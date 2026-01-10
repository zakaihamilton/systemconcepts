import storage from "@util/storage";
import { LOCAL_PERSONAL_PATH, LOCAL_PERSONAL_MANIFEST } from "../constants";
import { addSyncLog } from "@sync/logs";
import { calculateHash } from "@sync/hash";
import { calculateCanonicalHash } from "@sync/canonical";

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
                const keys = Object.keys(existingManifest);

            }
        } catch (err) {
            addSyncLog("[Personal] No existing manifest found, creating new one", "info");
        }

        // Build new manifest from current files only
        const manifest = {};
        for (const file of localFiles) {
            // Auto-migration: Move files from metadata/sessions/ to root
            if (file.path.startsWith("metadata/sessions/")) {
                const newRelativePath = file.path.substring("metadata/sessions/".length);
                const newFullPath = `${LOCAL_PERSONAL_PATH}/${newRelativePath}`;

                try {
                    await storage.moveFile(file.fullPath, newFullPath);
                    console.log(`[Personal] Migrated ${file.path} -> ${newRelativePath}`);

                    // Update file object to point to new location
                    file.path = newRelativePath;
                    file.fullPath = newFullPath;
                } catch (err) {
                    console.error(`[Personal] Failed to migrate ${file.path}:`, err);
                    // Continue with old path if move failed, so we don't crash
                }
            }

            const content = await storage.readFile(file.fullPath);
            let hash;

            if (file.path.endsWith(".json")) {
                try {
                    const json = JSON.parse(content);
                    hash = await calculateCanonicalHash(json);
                } catch (err) {
                    console.warn(`[Personal] Failed to parse JSON for canonical hash: ${file.path}`, err);
                    hash = await calculateHash(content);
                }
            } else {
                hash = await calculateHash(content);
            }

            // Preserve version from existing manifest, or default to 1
            // Force version bump to ensure all files are uploaded to fix phantom remote state
            // If version is already high, preserve it. Otherwise, jump to 2000000.
            const existingEntry = existingManifest[file.path];
            const currentVer = existingEntry ? (existingEntry.version || 1) : 1;
            const version = currentVer >= 2000000 ? currentVer : 2000000;



            manifest[file.path] = {
                hash,
                modified: Date.now(),
                version
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
