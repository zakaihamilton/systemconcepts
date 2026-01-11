import storage from "@util/storage";
import { makePath } from "@util/path";
import { PERSONAL_SYNC_BASE_PATH, LOCAL_PERSONAL_PATH, PERSONAL_BATCH_SIZE } from "../constants";
import { addSyncLog } from "@sync/logs";
import { compressJSON } from "@sync/bundle";

/**
 * Step 5: Upload files that were modified locally
 */
export async function uploadUpdates(localManifest, remoteManifest, userid, onProgress) {
    const start = performance.now();
    addSyncLog("[Personal] Step 5: Uploading updates...", "info");

    // Replace {userid} placeholder in path
    const basePath = PERSONAL_SYNC_BASE_PATH.replace("{userid}", userid);

    try {
        const filesToUpload = [];

        // Find files to upload (modified locally)
        for (const [path, localInfo] of Object.entries(localManifest)) {
            const remoteInfo = remoteManifest[path];

            if (remoteInfo && localInfo.hash !== remoteInfo.hash && localInfo.modified > remoteInfo.modified) {
                filesToUpload.push(path);
            }
        }

        if (filesToUpload.length === 0) {
            addSyncLog("[Personal] No files to upload", "info");
            return { manifest: remoteManifest, hasChanges: false };
        }

        addSyncLog(`[Personal] Uploading ${filesToUpload.length} modified file(s)...`, "info");

        if (onProgress) {
            onProgress(0, filesToUpload.length);
        }

        // Upload in batches
        for (let i = 0; i < filesToUpload.length; i += PERSONAL_BATCH_SIZE) {
            const batch = filesToUpload.slice(i, i + PERSONAL_BATCH_SIZE);
            const processedCount = i;

            if (onProgress) {
                onProgress(processedCount, filesToUpload.length);
            }

            await Promise.all(batch.map(async (path) => {
                const localPath = makePath(LOCAL_PERSONAL_PATH, path);
                let remotePath = makePath(basePath, path);

                try {
                    let content = await storage.readFile(localPath);

                    // Check if file should be compressed (all json files)
                    if (path.endsWith(".json")) {
                        // Content from storage.readFile is string for .json
                        const json = JSON.parse(content);
                        const compressed = compressJSON(json);
                        const buffer = Buffer.from(compressed);
                        // AWS/Storage needs base64 for binary
                        content = buffer.toString('base64');
                        remotePath += ".gz";
                    }

                    await storage.writeFile(remotePath, content);

                    // Update remote manifest (using logical path, not .gz)
                    // Increment version to signal change
                    const currentVer = (remoteManifest[path] && remoteManifest[path].version) || 1;
                    const newVer = currentVer + 1;

                    remoteManifest[path] = {
                        ...localManifest[path],
                        version: newVer
                    };

                    // Also update local manifest to reflect the new version
                    // so we don't redownload our own upload
                    if (localManifest[path]) {
                        localManifest[path].version = newVer;
                    }

                    addSyncLog(`[Personal] Uploaded: ${path}`, "info");
                } catch (err) {
                    console.error(`[Personal] Error uploading ${path}:`, err);
                }
            }));
        }

        const duration = ((performance.now() - start) / 1000).toFixed(1);
        addSyncLog(`[Personal] ✓ Uploaded ${filesToUpload.length} file(s) in ${duration}s`, "info");

        return { manifest: remoteManifest, hasChanges: true };
    } catch (err) {
        console.error("[Personal Sync] Step 5 error:", err);
        throw err;
    }
}
