import storage from "@util/storage";
import { makePath } from "@util/path";
import { PERSONAL_SYNC_BASE_PATH, PERSONAL_MANIFEST } from "../constants";
import { addSyncLog } from "@sync/logs";
import { calculateHash } from "@sync/hash";
import { readCompressedFile, writeCompressedFile, decompressJSON } from "@sync/bundle";

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

        // Normalize paths in existing manifest (strip leading slashes from old entries)
        if (Object.keys(remoteManifest).length > 0) {
            const normalizedManifest = {};
            let hadLeadingSlashes = false;

            for (const [path, entry] of Object.entries(remoteManifest)) {
                const normalizedPath = path.startsWith("/") ? path.substring(1) : path;
                if (path !== normalizedPath) {
                    hadLeadingSlashes = true;
                }
                normalizedManifest[normalizedPath] = entry;
            }
            remoteManifest = normalizedManifest;

            // If we normalized any paths, save the cleaned manifest back to AWS
            if (hadLeadingSlashes) {
                addSyncLog(`[Personal] Cleaning manifest (removing leading slashes)`, "info");
                await writeCompressedFile(remoteManifestPath, remoteManifest);
                addSyncLog(`[Personal] ✓ Uploaded cleaned manifest`, "info");
            }

            addSyncLog(`[Personal] Found existing manifest with ${Object.keys(remoteManifest).length} files`, "info");
        } else {
            // Bootstrap: Build manifest from existing remote files
            addSyncLog("[Personal] No manifest found, building from existing files...", "info");
            remoteManifest = await buildManifestFromRemote(basePath);

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
async function buildManifestFromRemote(basePath) {
    const manifest = {};

    try {
        // Get recursive listing of all files in aws/personal
        const listing = await storage.getRecursiveList(basePath);

        const files = listing.filter(item =>
            item.type !== "dir" &&
            item.name !== PERSONAL_MANIFEST &&
            !item.name.endsWith(".DS_Store")
        );

        addSyncLog(`[Personal] Found ${files.length} existing remote files to add to manifest`, "info");

        // Build manifest entries for each file
        for (const item of files) {
            let relPath = item.path.substring(basePath.length + 1);
            // Storage paths have leading slash, basePath doesn't, so strip it
            if (relPath.startsWith("/")) {
                relPath = relPath.substring(1);
            }
            let content;

            try {
                // Handle compressed metadata files
                if (relPath.endsWith(".json.gz")) {
                    // Read file as buffer/base64
                    const fileData = await storage.readFile(item.path);
                    let buffer;
                    if (typeof fileData === 'string') {
                        buffer = Buffer.from(fileData, 'base64');
                    } else if (Buffer.isBuffer(fileData)) {
                        buffer = fileData;
                    } else {
                        buffer = Buffer.from(fileData);
                    }

                    // Decompress to get original content for hash
                    const json = decompressJSON(buffer);
                    content = JSON.stringify(json, null, 4); // Use same formatting as when writing files


                    // Use logical path (without .gz)
                    relPath = relPath.slice(0, -3);
                } else {
                    // Read file normally
                    content = await storage.readFile(item.path);
                }

                const hash = await calculateHash(content);


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
