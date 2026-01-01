import storage from "@util/storage";
import { makePath } from "@util/path";
import { LOCAL_SYNC_PATH, FILES_MANIFEST } from "../constants";
import { addSyncLog } from "../logs";

/**
 * Step: Remove local files that no longer exist on remote
 * This ensures local storage stays in sync with the server
 */
export async function removeDeletedFiles(localManifest, remoteManifest) {
    const start = performance.now();
    addSyncLog("Checking for deleted files...", "info");

    try {
        const remotePathsSet = new Set(remoteManifest.map(f => f.path));
        const toDelete = localManifest.filter(f => !remotePathsSet.has(f.path));

        if (toDelete.length === 0) {
            addSyncLog("✓ No deleted files to remove", "info");
            return { manifest: localManifest, hasChanges: false };
        }

        addSyncLog(`Removing ${toDelete.length} deleted file(s)...`, "info");

        // Delete files
        for (const file of toDelete) {
            try {
                const filePath = makePath(LOCAL_SYNC_PATH, file.path);
                if (await storage.exists(filePath)) {
                    await storage.deleteFile(filePath);
                    addSyncLog(`Removed: ${file.path}`, "info");
                }
            } catch (err) {
                console.error(`[Sync] Failed to delete ${file.path}:`, err);
                addSyncLog(`Failed to remove: ${file.path}`, "error");
            }
        }

        // Update manifest to remove deleted files
        const updatedManifest = localManifest.filter(f => remotePathsSet.has(f.path));

        // Write updated manifest
        const manifestPath = makePath(LOCAL_SYNC_PATH, FILES_MANIFEST);
        await storage.writeFile(manifestPath, JSON.stringify(updatedManifest, null, 4));

        const duration = ((performance.now() - start) / 1000).toFixed(1);
        addSyncLog(`✓ Removed ${toDelete.length} file(s) in ${duration}s`, "success");

        return { manifest: updatedManifest, hasChanges: toDelete.length > 0 };

    } catch (err) {
        console.error("[Sync] Remove deleted files failed:", err);
        addSyncLog(`Remove deleted files failed: ${err.message}`, "error");
        throw err;
    }
}
