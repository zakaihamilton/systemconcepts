import storage from "@util/storage";
import { makePath } from "@util/path";
import { PERSONAL_SYNC_BASE_PATH, PERSONAL_MANIFEST } from "../constants";
import { addSyncLog } from "@sync/logs";
import { calculateHash } from "@sync/hash";
import { readCompressedFile, writeCompressedFile } from "@sync/bundle";

/**
 * Step 3: Download the remote manifest and compare with local
 * If manifest doesn't exist or is empty, build it from existing remote files
 */
export async function syncManifest(localManifest, userid) {
    const start = performance.now();
    addSyncLog("[Personal] Step 3: Syncing manifest...", "info");

    // Replace {userid} placeholder in path
    const basePath = PERSONAL_SYNC_BASE_PATH.replace("{userid}", userid);
    const remoteManifestPath = makePath(basePath, PERSONAL_MANIFEST);

    try {
        let remoteManifest = await readCompressedFile(remoteManifestPath) || {};

        if (Object.keys(remoteManifest).length > 0) {
            addSyncLog(`[Personal] Found existing manifest with ${Object.keys(remoteManifest).length} files`, "info");
        } else {
            // Bootstrap: Build manifest from existing remote files
            addSyncLog("[Personal] No manifest found, building from existing files...", "info");
            remoteManifest = await buildManifestFromRemote();

            // Save the newly built manifest
            if (Object.keys(remoteManifest).length > 0) {
                await writeCompressedFile(remoteManifestPath, remoteManifest);
                addSyncLog(`[Personal] Created manifest with ${Object.keys(remoteManifest).length} existing files`, "info");
            }
        }

        const duration = ((performance.now() - start) / 1000).toFixed(1);
        addSyncLog(`[Personal] ✓ Synced manifest in ${duration}s (${Object.keys(remoteManifest).length} remote files)`, "info");
        return remoteManifest;
    } catch (err) {
        console.error("[Personal Sync] Step 3 error:", err);
        throw err;
    }
}

/**
 * Build manifest from existing remote files
 */
async function buildManifestFromRemote() {
    const manifest = {};

    try {
        // Get recursive listing of all files in aws/personal
        const listing = await storage.getRecursiveList(PERSONAL_SYNC_BASE_PATH);

        const files = listing.filter(item =>
            item.type !== "dir" &&
            item.name !== PERSONAL_MANIFEST &&
            !item.name.endsWith(".DS_Store")
        );

        addSyncLog(`[Personal] Found ${files.length} existing remote files to add to manifest`, "info");

        // Build manifest entries for each file
        for (const item of files) {
            const relPath = item.path.substring(basePath.length + 1);

            try {
                // Read file to calculate hash
                const content = await storage.readFile(item.path);
                const hash = calculateHash(content);

                manifest[relPath] = {
                    hash,
                    modified: item.mtimeMs || Date.now()
                };
            } catch (err) {
                console.error(`[Personal] Error processing ${relPath}:`, err);
            }
        }

        return manifest;
    } catch (err) {
        console.error("[Personal] Error building manifest from remote:", err);
        return {};
    }
}
