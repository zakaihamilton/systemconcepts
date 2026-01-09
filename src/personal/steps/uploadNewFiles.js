import storage from "@util/storage";
import { makePath } from "@util/path";
import { PERSONAL_SYNC_BASE_PATH, LOCAL_PERSONAL_PATH, PERSONAL_BATCH_SIZE } from "../constants";
import { addSyncLog } from "@sync/logs";
import { compressJSON } from "@sync/bundle";

/**
 * Step 6: Upload new files that don't exist on remote
 */
export async function uploadNewFiles(localManifest, remoteManifest, userid) {
    const start = performance.now();
    addSyncLog("[Personal] Step 6: Uploading new files...", "info");

    // Replace {userid} placeholder in path
    const basePath = PERSONAL_SYNC_BASE_PATH.replace("{userid}", userid);

    try {
        const filesToUpload = [];

        // Find files that exist locally but not on remote
        for (const path of Object.keys(localManifest)) {
            if (!remoteManifest[path]) {
                filesToUpload.push(path);
            }
        }

        if (filesToUpload.length === 0) {
            addSyncLog("[Personal] No new files to upload", "info");
            return { manifest: remoteManifest, hasChanges: false };
        }

        addSyncLog(`[Personal] Uploading ${filesToUpload.length} new file(s)...`, "info");

        // Upload in batches
        for (let i = 0; i < filesToUpload.length; i += PERSONAL_BATCH_SIZE) {
            const batch = filesToUpload.slice(i, i + PERSONAL_BATCH_SIZE);

            await Promise.all(batch.map(async (path) => {
                // Map remote key (sessions/...) back to local path (metadata/sessions/...)
                let localRelativePath = path;
                if (path.startsWith("sessions/")) {
                    localRelativePath = "metadata/" + path;
                }
                const localPath = makePath(LOCAL_PERSONAL_PATH, localRelativePath);
                let remotePath = makePath(basePath, path);

                try {
                    let content = await storage.readFile(localPath);

                    // Check if file should be compressed (metadata/sessions)
                    if (path.startsWith("sessions/") && path.endsWith(".json")) {
                        // Content from storage.readFile is string for .json
                        const json = JSON.parse(content);
                        const compressed = compressJSON(json);
                        const buffer = Buffer.from(compressed);
                        // AWS/Storage needs base64 for binary
                        content = buffer.toString('base64');
                        remotePath += ".gz";
                    }

                    await storage.writeFile(remotePath, content);

                    // Add to remote manifest (using logical path)
                    remoteManifest[path] = { ...localManifest[path] };

                    addSyncLog(`[Personal] Uploaded new: ${path}`, "info");
                } catch (err) {
                    console.error(`[Personal] Error uploading ${path}:`, err);
                }
            }));
        }

        const duration = ((performance.now() - start) / 1000).toFixed(1);
        addSyncLog(`[Personal] ✓ Uploaded ${filesToUpload.length} new file(s) in ${duration}s`, "info");

        return { manifest: remoteManifest, hasChanges: true };
    } catch (err) {
        console.error("[Personal Sync] Step 6 error:", err);
        throw err;
    }
}
