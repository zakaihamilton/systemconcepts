import storage from "@util/storage";
import { makePath } from "@util/path";
import { PERSONAL_SYNC_BASE_PATH, LOCAL_PERSONAL_PATH, PERSONAL_BATCH_SIZE } from "../constants";
import { addSyncLog } from "@sync/logs";
import { calculateHash } from "@sync/hash";
import { calculateCanonicalHash } from "@sync/canonical";
import { readCompressedFile } from "@sync/bundle";
import { GroupFilter } from "../groups";

/**
 * Step 4: Download files that are newer/different on remote
 */
export async function downloadUpdates(localManifest, remoteManifest, userid) {
    const start = performance.now();
    addSyncLog("[Personal] Step 4: Downloading updates...", "info");

    // Replace {userid} placeholder in path
    const basePath = PERSONAL_SYNC_BASE_PATH.replace("{userid}", userid);

    try {
        // Load groups for filtering to prevent downloading ignored files
        const groupFilter = new GroupFilter();
        await groupFilter.load();

        // Clean local manifest of any entries with leading slashes (from old data)
        const cleanedLocalManifest = {};
        for (const [path, entry] of Object.entries(localManifest)) {
            const normalizedPath = path.startsWith("/") ? path.substring(1) : path;
            cleanedLocalManifest[normalizedPath] = entry;
        }
        localManifest = cleanedLocalManifest;

        const filesToDownload = [];

        // Find files to download
        for (const [path, remoteInfo] of Object.entries(remoteManifest)) {
            // Check if file should be included based on group filters
            if (!groupFilter.shouldIncludeFile(path)) {
                continue; // Skip ignored files (e.g. filtered split/bundle files)
            }

            const localInfo = localManifest[path];
            const remoteVer = remoteInfo.version || 1;
            const localVer = localInfo ? (localInfo.version || 0) : 0;

            if (path.includes("yossi/2022.json")) {
                console.log(`[DEBUG] Comparing yossi/2022.json. RemoteVer: ${remoteVer}, LocalVer: ${localVer}. Download? ${remoteVer > localVer}`);
            }

            // Only download if remote version is strictly greater than local version
            // This is robust against hash calculation differences
            if (remoteVer > localVer) {
                filesToDownload.push(path);
            }
        }

        if (filesToDownload.length === 0) {
            addSyncLog("[Personal] No files to download", "info");
            return { manifest: localManifest, cleanedRemoteManifest: remoteManifest, hasChanges: false };
        }

        addSyncLog(`[Personal] Downloading ${filesToDownload.length} file(s)...`, "info");

        // Download in batches
        for (let i = 0; i < filesToDownload.length; i += PERSONAL_BATCH_SIZE) {
            const batch = filesToDownload.slice(i, i + PERSONAL_BATCH_SIZE);

            await Promise.all(batch.map(async (path) => {
                // Skip invalid paths
                if (!path || !path.trim() || path.trim() === '.json') {
                    console.warn(`[Personal] Skipping invalid path: "${path}"`);
                    return;
                }

                let remotePath = makePath(basePath, path);
                const localPath = makePath(LOCAL_PERSONAL_PATH, path);

                try {
                    let content;

                    // Check if file should be compressed (all json files)
                    // If so, we expect a .gz file remotely
                    if (path.endsWith(".json")) {
                        // Try downloading .gz version
                        const gzPath = remotePath + ".gz";
                        // readCompressedFile handles decompression if needed
                        const data = await readCompressedFile(gzPath);
                        let hash;

                        if (data) {
                            content = JSON.stringify(data, null, 4);
                            hash = await calculateCanonicalHash(data);
                        } else {
                            // Fallback to normal file if .gz doesn't exist?
                            // If syncManifest found it as .json (legacy), we download .json.
                            content = await storage.readFile(remotePath);
                            hash = await calculateHash(content);
                        }

                        await storage.createFolderPath(localPath);
                        await storage.writeFile(localPath, content);

                        localManifest[path] = {
                            ...remoteManifest[path],
                            hash,
                            version: remoteManifest[path].version || 1
                        };

                        // Update remote manifest with the new canonical hash.
                        // This ensures that the remote manifest (files.json) on S3 gets updated 
                        // with the format-agnostic hash when uploadManifest runs (Step 7),
                        // preventing infinite download loops due to hash mismatch.
                        if (remoteManifest[path] && remoteManifest[path].hash !== hash) {
                            remoteManifest[path].hash = hash;
                        }
                    } else {
                        content = await storage.readFile(remotePath);
                        await storage.createFolderPath(localPath);
                        await storage.writeFile(localPath, content);

                        const hash = await calculateHash(content);

                        localManifest[path] = {
                            ...remoteManifest[path],
                            hash,
                            version: remoteManifest[path].version || 1
                        };

                        // Update remote manifest for consistency
                        if (remoteManifest[path] && remoteManifest[path].hash !== hash) {
                            remoteManifest[path].hash = hash;
                        }
                    }

                    addSyncLog(`[Personal] Downloaded: ${path}`, "info");
                } catch (err) {
                    console.error(`[Personal] Error downloading ${path}:`, err);
                    addSyncLog(`[Personal] Failed to download: ${path}`, "error");
                }
            }));
        }

        const duration = ((performance.now() - start) / 1000).toFixed(1);
        addSyncLog(`[Personal] ✓ Downloaded ${filesToDownload.length} file(s) in ${duration}s`, "info");

        return { manifest: localManifest, cleanedRemoteManifest: remoteManifest, hasChanges: true };
    } catch (err) {
        console.error("[Personal Sync] Step 4 error:", err);
        throw err;
    }
}
