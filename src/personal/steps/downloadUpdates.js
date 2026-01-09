import storage from "@util/storage";
import { makePath } from "@util/path";
import { PERSONAL_SYNC_BASE_PATH, LOCAL_PERSONAL_PATH, PERSONAL_BATCH_SIZE } from "../constants";
import { addSyncLog } from "@sync/logs";
import { calculateHash } from "@sync/hash";
import { readCompressedFile } from "@sync/bundle";

/**
 * Step 4: Download files that are newer/different on remote
 */
export async function downloadUpdates(localManifest, remoteManifest, userid) {
    const start = performance.now();
    addSyncLog("[Personal] Step 4: Downloading updates...", "info");

    // Replace {userid} placeholder in path
    const basePath = PERSONAL_SYNC_BASE_PATH.replace("{userid}", userid);

    try {
        const filesToDownload = [];

        // Find files to download
        for (const [path, remoteInfo] of Object.entries(remoteManifest)) {
            const localInfo = localManifest[path];

            if (!localInfo || localInfo.hash !== remoteInfo.hash) {
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
                // Map remote key (sessions/...) back to local path (metadata/sessions/...)
                let localRelativePath = path;
                if (path.startsWith("sessions/")) {
                    localRelativePath = "metadata/" + path;
                }
                const localPath = makePath(LOCAL_PERSONAL_PATH, localRelativePath);

                try {
                    let content;

                    // Check if file should be compressed (metadata/sessions)
                    // If so, we expect a .gz file remotely
                    if (path.startsWith("sessions/") && path.endsWith(".json")) {
                         // Try downloading .gz version
                         const gzPath = remotePath + ".gz";
                         // readCompressedFile handles decompression if needed
                         const data = await readCompressedFile(gzPath);
                         if (data) {
                             content = JSON.stringify(data, null, 4);
                         } else {
                             // Fallback to normal file if .gz doesn't exist?
                             // Or maybe the manifest was built from a non-gz file (legacy)?
                             // But syncManifest handles .gz -> logical path mapping.
                             // If manifest has entry, syncManifest found it.
                             // If syncManifest found it as .gz, we should download .gz.
                             // If syncManifest found it as .json, we download .json.
                             // But we stripped .gz in syncManifest logic if it existed.
                             // So we should try .gz first.

                             // If readCompressedFile failed, maybe try without .gz?
                             content = await storage.readFile(remotePath);
                         }
                    } else {
                         content = await storage.readFile(remotePath);
                    }

                    await storage.createFolderPath(localPath);
                    await storage.writeFile(localPath, content);

                    // Update local manifest with the hash of the content we just wrote
                    // This prevents infinite download loops if the local hash calculation
                    // differs from the remote hash (e.g. due to line endings or formatting)
                    const hash = await calculateHash(content);
                    localManifest[path] = {
                        ...remoteManifest[path],
                        hash
                    };

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
