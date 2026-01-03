import storage from "@util/storage";
import { makePath } from "@util/path";
import { PERSONAL_SYNC_BASE_PATH, LOCAL_PERSONAL_PATH, PERSONAL_BATCH_SIZE } from "../constants";
import { addSyncLog } from "@sync/logs";
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
                const remotePath = makePath(basePath, path);
                const localPath = makePath(LOCAL_PERSONAL_PATH, path);

                try {
                    const content = await storage.readFile(remotePath);
                    await storage.writeFile(localPath, content);

                    // Update local manifest
                    localManifest[path] = { ...remoteManifest[path] };

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
