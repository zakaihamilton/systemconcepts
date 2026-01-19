import { lockMutex } from "@sync/mutex";
import { addSyncLog } from "@sync/logs";
import storage from "@util/storage";
import Cookies from "js-cookie";
import { SyncActiveStore } from "@sync/syncState";
import { SyncProgressTracker } from "@sync/progressTracker";
import { makePath } from "@util/path";
import { LOCAL_PERSONAL_PATH, LOCAL_PERSONAL_MANIFEST } from "./constants";

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
export async function performPersonalSync(phaseOffset = 0, combinedTotalWeight = null, locked = false) {
    const unlock = await lockMutex({ id: "personal_sync_process" });
    addSyncLog("[Personal] Starting personal sync process...", "info");
    const startTime = performance.now();
    let hasChanges = false;
    const progress = new SyncProgressTracker(phaseOffset, combinedTotalWeight);
    progress.usePersonalWeights();

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
        let remoteManifest = await syncManifest(localManifest, userid, locked);
        addSyncLog(`[Personal] Local manifest has ${Object.keys(localManifest).length} files`, "info");
        addSyncLog(`[Personal] Remote manifest has ${Object.keys(remoteManifest).length} files`, "info");
        progress.completeStep('syncManifest');

        // Step 3.5: Migrate from MongoDB if needed
        progress.updateProgress('migrateFromMongoDB', { processed: 0, total: 1 });
        const { migrateFromMongoDB } = await import("./steps/migrateFromMongoDB");
        const migrationResult = await migrateFromMongoDB(userid, remoteManifest);

        if (migrationResult.migrated) {
            addSyncLog(`[Personal] Migration complete: ${migrationResult.fileCount} files`, "success");

            // Remove deleted keys (fixed double slashes)
            if (migrationResult.deletedKeys) {
                migrationResult.deletedKeys.forEach(key => {
                    delete remoteManifest[key];
                });
            }

            // Reload local manifest from disk because migration updated it
            const manifestPath = makePath(LOCAL_PERSONAL_PATH, LOCAL_PERSONAL_MANIFEST);
            if (await storage.exists(manifestPath)) {
                const content = await storage.readFile(manifestPath);
                localManifest = JSON.parse(content);
                addSyncLog(`[Personal] Reloaded local manifest: ${Object.keys(localManifest).length} files`, "info");
            }

            // Fix for "Removal before Upload":
            // Migration created new local files. removeDeletedFiles (Step 4.5) will delete them
            // because they are not in remoteManifest yet.
            // We must add them to remoteManifest in-memory so they survive Step 4.5.
            // We set hash="FORCE_UPLOAD" and modified=0 to ensure uploadUpdates (Step 5) picks them up.
            if (migrationResult.manifest) {
                // If migrationResult.migrated is map of paths, extracting keys might be tricky because paths are absolute/relative?
                // Actually migrationResult.manifest contains the entries we care about.
                for (const [key, entry] of Object.entries(migrationResult.manifest)) {
                    // Only protect if it's not already in remote (or if we forced it)
                    if (!remoteManifest[key]) {
                        remoteManifest[key] = {
                            ...entry,
                            hash: "FORCE_UPLOAD",
                            modified: 0,
                            version: (entry.version || 1)
                        };
                    }
                }
            }
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

        if (!locked) {
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
        } else {
            addSyncLog(`[Personal] Uploads skipped because sync is locked`, "warning");
            progress.completeStep('uploadUpdates');
            progress.completeStep('uploadNewFiles');
            progress.completeStep('uploadManifest');
        }
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
        let errorMessage = err.message || String(err);
        if (err === 401 || err === 403) {
            errorMessage = "Please login to sync";
        }
        addSyncLog(`[Personal] Sync failed: ${errorMessage}`, "error");

        let error = err;
        if (err === 401 || err === 403) {
            error = new Error(errorMessage);
            error.code = "NOT_LOGGED_IN";
        }

        return { success: false, error: error };
    } finally {
        unlock();
    }
}
