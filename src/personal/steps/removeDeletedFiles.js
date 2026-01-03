import storage from "@util/storage";
import { makePath } from "@util/path";
import { PERSONAL_SYNC_BASE_PATH, LOCAL_PERSONAL_PATH } from "../constants";
import { addSyncLog } from "@sync/logs";

/**
 * Step 4.5: Remove files that were deleted on remote
 */
export async function removeDeletedFiles(localManifest, remoteManifest) {
    const start = performance.now();
    addSyncLog("[Personal] Step 4.5: Removing deleted files...", "info");

    try {
        const filesToRemove = [];

        // Find files that exist locally but not on remote
        for (const path of Object.keys(localManifest)) {
            if (!remoteManifest[path]) {
                filesToRemove.push(path);
            }
        }

        if (filesToRemove.length === 0) {
            addSyncLog("[Personal] No files to remove", "info");
            return { manifest: localManifest, hasChanges: false };
        }

        addSyncLog(`[Personal] Removing ${filesToRemove.length} deleted file(s)...`, "info");

        for (const path of filesToRemove) {
            const localPath = makePath(LOCAL_PERSONAL_PATH, path);

            try {
                // Check if file exists before trying to delete
                if (await storage.exists(localPath)) {
                    await storage.deleteFile(localPath);
                    addSyncLog(`[Personal] Removed: ${path}`, "info");
                } else {
                    addSyncLog(`[Personal] Skipped (not found locally): ${path}`, "info");
                }
                delete localManifest[path];
            } catch (err) {
                console.error(`[Personal] Error removing ${path}:`, err);
            }
        }

        const duration = ((performance.now() - start) / 1000).toFixed(1);
        addSyncLog(`[Personal] ✓ Removed ${filesToRemove.length} file(s) in ${duration}s`, "info");

        return { manifest: localManifest, hasChanges: true };
    } catch (err) {
        console.error("[Personal Sync] Step 4.5 error:", err);
        throw err;
    }
}
