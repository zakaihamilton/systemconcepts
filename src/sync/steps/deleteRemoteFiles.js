import storage from "@util/storage";
import { makePath } from "@util/path";
import { addSyncLog } from "../logs";

/**
 * Step: Delete files from remote that are marked as deleted in local manifest
 * @param {Array} localManifest - The local manifest
 * @param {string} remotePath - The remote path to sync to
 * @returns {Array} List of paths that were successfully deleted from remote
 */
export async function deleteRemoteFiles(localManifest, remotePath) {
    const start = performance.now();
    const toDelete = localManifest.filter(f => f.deleted);

    if (toDelete.length === 0) {
        return [];
    }

    addSyncLog(`Step: Deleting ${toDelete.length} file(s) from remote...`, "info");
    const deletedPaths = [];

    for (const file of toDelete) {
        try {
            const remoteFilePath = makePath(remotePath, file.path);
            const remoteFilePathGz = makePath(remotePath, file.path + ".gz");

            // Try to delete both original and compressed versions
            await storage.deleteFile(remoteFilePath);
            try {
                // If it fails (e.g. doesn't exist), we don't care much, but we try both
                await storage.deleteFile(remoteFilePathGz);
            } catch {
                // Ignore gz delete error
            }

            addSyncLog(`Deleted from remote: ${file.path}`, "info");
            deletedPaths.push(file.path);
        } catch (err) {
            console.error(`[Sync] Failed to delete remote file ${file.path}:`, err);
            addSyncLog(`Failed to delete from remote: ${file.path}`, "error");
        }
    }

    const duration = ((performance.now() - start) / 1000).toFixed(1);
    if (deletedPaths.length > 0) {
        addSyncLog(`✓ Deleted ${deletedPaths.length} file(s) from remote in ${duration}s`, "success");
    }

    return deletedPaths;
}
