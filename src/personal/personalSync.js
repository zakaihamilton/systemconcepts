import { lockMutex } from "@sync/mutex";
import { addSyncLog } from "@sync/logs";
import storage from "@util/storage";
import Cookies from "js-cookie";
import { SyncActiveStore } from "@sync/syncState";

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

    try {
        // Get userid from cookies
        const userid = Cookies.get("id");
        if (!userid) {
            throw new Error("User ID not found in cookies");
        }
        addSyncLog(`[Personal] Syncing for user: ${userid}`, "info");

        // Step 1: Get local personal files
        const localFiles = await getLocalFiles();

        // Step 2: Update local manifest
        let localManifest = await updateLocalManifest(localFiles);

        // Step 3: Sync with remote manifest
        let remoteManifest = await syncManifest(localManifest, userid);
        addSyncLog(`[Personal] Local manifest has ${Object.keys(localManifest).length} files`, "info");
        addSyncLog(`[Personal] Remote manifest has ${Object.keys(remoteManifest).length} files`, "info");

        // Step 3.5: Migrate from MongoDB if needed
        const { migrateFromMongoDB } = await import("./steps/migrateFromMongoDB");
        const basePath = `aws/personal/${userid}`;
        const migrationResult = await migrateFromMongoDB(userid, remoteManifest, basePath);

        if (migrationResult.migrated) {
            addSyncLog(`[Personal] Migration complete: ${migrationResult.fileCount} files`, "success");

            // Merge migration manifest into remote manifest
            if (migrationResult.manifest) {
                remoteManifest = { ...remoteManifest, ...migrationResult.manifest };
            }

            // Upload the updated manifest
            const { uploadManifest } = await import("./steps/uploadManifest");
            await uploadManifest(remoteManifest, userid);

            // Re-sync to get the updated manifest
            remoteManifest = await syncManifest(localManifest, userid);
            addSyncLog(`[Personal] Re-synced manifest after migration: ${Object.keys(remoteManifest).length} files`, "info");
        }

        // Step 4: Download updates
        const downloadResult = await downloadUpdates(localManifest, remoteManifest, userid);
        localManifest = downloadResult.manifest;
        remoteManifest = downloadResult.cleanedRemoteManifest || remoteManifest;
        hasChanges = hasChanges || downloadResult.hasChanges;
        addSyncLog(`[Personal] After downloads, local manifest has ${Object.keys(localManifest).length} files`, "info");

        // Save local manifest after downloads
        if (downloadResult.hasChanges) {
            const { LOCAL_PERSONAL_PATH, PERSONAL_MANIFEST } = await import("./constants");
            const manifestPath = `${LOCAL_PERSONAL_PATH}/${PERSONAL_MANIFEST}`;
            await storage.writeFile(manifestPath, JSON.stringify(localManifest, null, 4));
            addSyncLog("[Personal] Saved updated local manifest after downloads", "info");
        }

        // Step 4.5: Remove deleted files
        const removeResult = await removeDeletedFiles(localManifest, remoteManifest);
        localManifest = removeResult.manifest;
        hasChanges = hasChanges || removeResult.hasChanges;

        // Step 5: Upload updates
        const uploadUpdatesResult = await uploadUpdates(localManifest, remoteManifest, userid);
        remoteManifest = uploadUpdatesResult.manifest;
        hasChanges = hasChanges || uploadUpdatesResult.hasChanges;

        // Step 6: Upload new files
        const uploadNewResult = await uploadNewFiles(localManifest, remoteManifest, userid);
        remoteManifest = uploadNewResult.manifest;
        hasChanges = hasChanges || uploadNewResult.hasChanges;

        // Step 7: Upload manifest
        await uploadManifest(remoteManifest, userid);

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
