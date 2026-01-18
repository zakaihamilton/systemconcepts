import storage from "@util/storage";
import { makePath } from "@util/path";
import { LOCAL_SYNC_PATH, FILES_MANIFEST } from "../constants";
import { addSyncLog } from "../logs";

/**
 * Step: Remove local files that no longer exist on remote
 * This ensures local storage stays in sync with the server
 */
export async function removeDeletedFiles(localManifest, remoteManifest, localPath = LOCAL_SYNC_PATH, readOnly = false) {
    const start = performance.now();
    addSyncLog("Checking for deleted files...", "info");

    try {
        // Safety check: If we didn't load from a manifest file, do not delete local files.
        // This prevents mass deletion when the remote folder is missing or inaccessible (e.g., failed listing).
        if (!remoteManifest.loadedFromManifest) {
            if (remoteManifest.length === 0) {
                addSyncLog("Remote manifest missing/empty - skipping deletion for safety", "warning");
            } else {
                addSyncLog("Remote manifest generated from listing - skipping deletion for safety", "warning");
            }
            return { manifest: localManifest, hasChanges: false };
        }

        const remotePathsSet = new Set(remoteManifest.map(f => f.path));

        // Only delete files that were previously synced (version > 1)
        // Don't delete new files (version = 1) that haven't been uploaded yet
        // UNLESS we are in read-only mode, in which case we enforce a strict mirror
        const toDelete = localManifest.filter(f => {
            if (remotePathsSet.has(f.path)) return false;

            // If read-only, everything local but not remote is "garbage" to be removed
            if (readOnly) return true;

            const version = parseInt(f.version || "1");
            return version > 1;
        });

        if (toDelete.length === 0) {
            addSyncLog("✓ No deleted files to remove", "info");
            return { manifest: localManifest, hasChanges: false };
        }

        addSyncLog(`Removing ${toDelete.length} deleted file(s)...`, "info");

        // Delete files
        for (const file of toDelete) {
            try {
                const filePath = makePath(localPath, file.path);
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
        const manifestPath = makePath(localPath, FILES_MANIFEST);
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
