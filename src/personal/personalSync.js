import { lockMutex } from "@sync/mutex";
import { addSyncLog } from "@sync/logs";
import storage from "@util/storage";
import Cookies from "js-cookie";
import { SyncActiveStore } from "@sync/syncState";
import { SyncProgressTracker } from "@sync/progressTracker";

// Step Imports
import { getLocalFiles } from "./steps/getLocalFiles";
import { updateLocalManifest } from "./steps/updateLocalManifest";
import { syncManifest } from "./steps/syncManifest";
import { downloadUpdates } from "./steps/downloadUpdates";
import { uploadUpdates } from "./steps/uploadUpdates";
import { uploadNewFiles } from "./steps/uploadNewFiles";
import { removeDeletedFiles } from "./steps/removeDeletedFiles";
import { uploadManifest } from "./steps/uploadManifest";

/**
 * Main personal sync function
 * Runs independently from main sync but follows same pattern
 */
export async function performPersonalSync() {
    const unlock = await lockMutex({ id: "personal_sync_process" });
    addSyncLog("[Personal] Starting personal sync process...", "info");
    const startTime = performance.now();
    let hasChanges = false;
    const progress = new SyncProgressTracker(true);

    try {
        // Get userid from cookies
        const userid = Cookies.get("id");
        if (!userid) {
            const error = new Error("User not logged in");
            error.code = "NOT_LOGGED_IN";
            throw error;
        }
        addSyncLog(`[Personal] Syncing for user: ${userid}`, "info");

        // Step 1: Get local personal files
        progress.updateProgress('getLocalFiles', { processed: 0, total: 1 });
        const localFiles = await getLocalFiles();
        progress.completeStep('getLocalFiles');

        // Step 2: Update local manifest
        progress.updateProgress('updateLocalManifest', { processed: 0, total: 1 });
        let localManifest = await updateLocalManifest(localFiles);
        progress.completeStep('updateLocalManifest');

        // Step 3: Sync with remote manifest
        progress.updateProgress('syncManifest', { processed: 0, total: 1 });
        let remoteManifest = await syncManifest(localManifest, userid);
        addSyncLog(`[Personal] Local manifest has ${Object.keys(localManifest).length} files`, "info");
        addSyncLog(`[Personal] Remote manifest has ${Object.keys(remoteManifest).length} files`, "info");
        progress.completeStep('syncManifest');

        // Step 3.5: Migrate from MongoDB if needed
        progress.updateProgress('migrateFromMongoDB', { processed: 0, total: 1 });
        const { migrateFromMongoDB } = await import("./steps/migrateFromMongoDB");
        const basePath = `aws/personal/${userid}`;
        const migrationResult = await migrateFromMongoDB(userid, remoteManifest, basePath);

        if (migrationResult.migrated) {
            addSyncLog(`[Personal] Migration complete: ${migrationResult.fileCount} files`, "success");

            // Merge migration manifest into remote manifest
            if (migrationResult.manifest) {
                remoteManifest = { ...remoteManifest, ...migrationResult.manifest };
            }

            // Remove deleted keys (fixed double slashes)
            if (migrationResult.deletedKeys) {
                migrationResult.deletedKeys.forEach(key => {
                    delete remoteManifest[key];
                });
            }

            // Upload the updated manifest
            const { uploadManifest } = await import("./steps/uploadManifest");
            await uploadManifest(remoteManifest, userid);

            // Re-sync to get the updated manifest
            remoteManifest = await syncManifest(localManifest, userid);
            addSyncLog(`[Personal] Re-synced manifest after migration: ${Object.keys(remoteManifest).length} files`, "info");
        }
        progress.completeStep('migrateFromMongoDB');

        // Step 4: Download updates
        progress.updateProgress('downloadUpdates', { processed: 0, total: 1 });
        const downloadResult = await downloadUpdates(localManifest, remoteManifest, userid, (processed, total) => {
            progress.updateProgress('downloadUpdates', { processed, total });
        });
        localManifest = downloadResult.manifest;
        remoteManifest = downloadResult.cleanedRemoteManifest || remoteManifest;
        hasChanges = hasChanges || downloadResult.hasChanges;
        addSyncLog(`[Personal] After downloads, local manifest has ${Object.keys(localManifest).length} files`, "info");
        progress.completeStep('downloadUpdates');

        // Save local manifest after downloads
        if (downloadResult.hasChanges) {
            const { LOCAL_PERSONAL_PATH, LOCAL_PERSONAL_MANIFEST } = await import("./constants");
            const manifestPath = `${LOCAL_PERSONAL_PATH}/${LOCAL_PERSONAL_MANIFEST}`;
            await storage.createFolderPath(manifestPath);
            await storage.writeFile(manifestPath, JSON.stringify(localManifest, null, 4));
            addSyncLog("[Personal] Saved updated local manifest after downloads", "info");
        }

        // Step 4.5: Remove deleted files
        progress.updateProgress('removeDeletedFiles', { processed: 0, total: 1 });
        const removeResult = await removeDeletedFiles(localManifest, remoteManifest);
        localManifest = removeResult.manifest;
        hasChanges = hasChanges || removeResult.hasChanges;
        progress.completeStep('removeDeletedFiles');

        // Step 5: Upload updates
        progress.updateProgress('uploadUpdates', { processed: 0, total: 1 });
        const uploadUpdatesResult = await uploadUpdates(localManifest, remoteManifest, userid, (processed, total) => {
            progress.updateProgress('uploadUpdates', { processed, total });
        });
        remoteManifest = uploadUpdatesResult.manifest;
        hasChanges = hasChanges || uploadUpdatesResult.hasChanges;
        progress.completeStep('uploadUpdates');

        // Step 6: Upload new files
        progress.updateProgress('uploadNewFiles', { processed: 0, total: 1 });
        const uploadNewResult = await uploadNewFiles(localManifest, remoteManifest, userid, (processed, total) => {
            progress.updateProgress('uploadNewFiles', { processed, total });
        });
        remoteManifest = uploadNewResult.manifest;
        hasChanges = hasChanges || uploadNewResult.hasChanges;
        progress.completeStep('uploadNewFiles');

        // Step 7: Upload manifest
        progress.updateProgress('uploadManifest', { processed: 0, total: 1 });
        await uploadManifest(remoteManifest, userid);
        progress.setComplete();

        const duration = ((performance.now() - startTime) / 1000).toFixed(1);
        addSyncLog(`[Personal] Sync complete in ${duration}s`, "success");

        if (hasChanges) {
            addSyncLog(`[Personal] Changes detected, triggering session reload`, "info");
            SyncActiveStore.update(s => {
                s.needsSessionReload = true;
            });
        } else {
            addSyncLog(`[Personal] No changes detected`, "info");
        }

        return { success: true, hasChanges };

    } catch (err) {
        console.error("[Personal Sync] Sync failed:", err);
        addSyncLog(`[Personal] Sync failed: ${err.message}`, "error");
        return { success: false, error: err };
    } finally {
        unlock();
    }
}
