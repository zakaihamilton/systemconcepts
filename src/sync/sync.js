import { useRef, useEffect, useState } from "react";
import storage from "@util/storage";
import Cookies from "js-cookie";
import { useOnline } from "@util/online";

import { usePageVisibility } from "@util/hooks";
import { SyncActiveStore, UpdateSessionsStore } from "@sync/syncState";
import { lockMutex } from "@sync/mutex";
import { LOCAL_SYNC_PATH } from "./constants";
import { addSyncLog } from "./logs";

// Step Imports
import { getLocalFiles } from "./steps/getLocalFiles";
import { updateLocalManifest } from "./steps/updateLocalManifest";
import { syncManifest } from "./steps/syncManifest";
import { downloadUpdates } from "./steps/downloadUpdates";
import { uploadUpdates } from "./steps/uploadUpdates";
import { uploadNewFiles } from "./steps/uploadNewFiles";
import { removeDeletedFiles } from "./steps/removeDeletedFiles";
import { uploadManifest } from "./steps/uploadManifest";
import { SyncProgressTracker } from "./progressTracker";

const SYNC_INTERVAL = 60; // seconds

/**
 * Main sync function
 */
export async function performSync() {
    const unlock = await lockMutex({ id: "sync_process" });
    addSyncLog("Starting sync process...", "info");
    const startTime = performance.now();
    let hasChanges = false;
    const progress = new SyncProgressTracker();

    try {
        // Step 1
        progress.updateProgress('getLocalFiles', { processed: 0, total: 1 });
        const localFiles = await getLocalFiles();
        progress.completeStep('getLocalFiles');

        // Step 2
        progress.updateProgress('updateLocalManifest', { processed: 0, total: 1 });
        let localManifest = await updateLocalManifest(localFiles);
        progress.completeStep('updateLocalManifest');

        // Step 3
        progress.updateProgress('syncManifest', { processed: 0, total: 1 });
        let remoteManifest = await syncManifest(localManifest);
        progress.completeStep('syncManifest');

        // Step 4
        progress.updateProgress('downloadUpdates', { processed: 0, total: 1 });
        const downloadResult = await downloadUpdates(localManifest, remoteManifest);
        localManifest = downloadResult.manifest;
        remoteManifest = downloadResult.cleanedRemoteManifest || remoteManifest;
        hasChanges = hasChanges || downloadResult.hasChanges;
        progress.completeStep('downloadUpdates');

        // Step 4.5: Remove files that were deleted on remote
        progress.updateProgress('removeDeletedFiles', { processed: 0, total: 1 });
        const removeResult = await removeDeletedFiles(localManifest, remoteManifest);
        localManifest = removeResult.manifest;
        hasChanges = hasChanges || removeResult.hasChanges;
        progress.completeStep('removeDeletedFiles');

        // Step 5
        progress.updateProgress('uploadUpdates', { processed: 0, total: 1 });
        const uploadUpdatesResult = await uploadUpdates(localManifest, remoteManifest);
        remoteManifest = uploadUpdatesResult.manifest;
        hasChanges = hasChanges || uploadUpdatesResult.hasChanges;
        progress.completeStep('uploadUpdates');

        // Step 6
        progress.updateProgress('uploadNewFiles', { processed: 0, total: 1 });
        const uploadNewResult = await uploadNewFiles(localManifest, remoteManifest);
        remoteManifest = uploadNewResult.manifest;
        hasChanges = hasChanges || uploadNewResult.hasChanges;
        progress.completeStep('uploadNewFiles');

        // Step 7
        progress.updateProgress('uploadManifest', { processed: 0, total: 1 });
        await uploadManifest(remoteManifest);
        progress.setComplete();

        const duration = ((performance.now() - startTime) / 1000).toFixed(1);
        addSyncLog(`Sync complete in ${duration}s`, "success");

        // Only trigger reload if sync actually changed something
        if (hasChanges) {
            SyncActiveStore.update(s => {
                s.needsSessionReload = true;
            });
            addSyncLog(`Changes detected - reloading sessions`, "info");
        } else {
            addSyncLog(`No changes detected`, "info");
        }

        // Run personal sync after main sync completes
        await runPersonalSync();

    } catch (err) {
        console.error("[Sync] Sync failed:", err);
        let errorMessage = err.message || String(err);
        if (err === 401 || err === 403) {
            errorMessage = "Please login to sync";
        }
        addSyncLog(`Sync failed: ${errorMessage}`, "error");
        throw err;
    } finally {
        unlock();
    }
}

/**
 * Run personal files sync
 */
async function runPersonalSync() {
    try {
        SyncActiveStore.update(s => {
            s.personalSyncBusy = true;
            s.personalSyncError = null;
            s.personalSyncProgress = { processed: 0, total: 0 };
        });

        const { performPersonalSync } = await import("@personal/personalSync");
        const result = await performPersonalSync();

        SyncActiveStore.update(s => {
            s.personalSyncBusy = false;
            if (!result.success) {
                s.personalSyncError = result.error?.message || "Personal sync failed";
            }
        });
    } catch (err) {
        console.error("[Personal Sync] Failed:", err);
        let errorMessage = err.message || "Unknown error";

        if (err.code === "NOT_LOGGED_IN" || errorMessage.includes("User not logged in") || errorMessage.includes("User ID not found")) {
            errorMessage = "Please login to sync personal files";
        }

        SyncActiveStore.update(s => {
            s.personalSyncBusy = false;
            s.personalSyncError = errorMessage;
        });
    }
}

export async function requestSync() {
    const isBusy = SyncActiveStore.getRawState().busy;
    const isSessionsBusy = UpdateSessionsStore.getRawState().busy;
    if (isBusy || isSessionsBusy) return;

    SyncActiveStore.update(s => {
        s.busy = true;
        s.startTime = Date.now();
        s.lastSyncTime = Date.now(); // Track when we started this sync
        s.logs = [];
    });

    try {
        await performSync();

        const endTime = Date.now();
        const syncDuration = endTime - SyncActiveStore.getRawState().startTime;
        SyncActiveStore.update(s => {
            s.busy = false;
            s.lastSynced = endTime;
            s.lastDuration = syncDuration;
            s.counter++;
        });
    } catch (err) {
        SyncActiveStore.update(s => {
            s.busy = false;
        });
    }
}

export function useSyncFeature() {
    const state = SyncActiveStore.useState(s => ({
        busy: s.busy,
        lastSynced: s.lastSynced,
        logs: s.logs,
        lastDuration: s.lastDuration,
        startTime: s.startTime,
        progress: s.progress,
        personalSyncBusy: s.personalSyncBusy,
        personalSyncError: s.personalSyncError,
        personalSyncProgress: s.personalSyncProgress
    }));

    const { busy, lastSynced, logs, lastDuration: duration, startTime, progress, personalSyncBusy, personalSyncError, personalSyncProgress } = state;

    const percentage = progress && progress.total > 0
        ? Math.round((progress.processed / progress.total) * 100)
        : 0;

    const personalPercentage = personalSyncProgress && personalSyncProgress.total > 0
        ? Math.round((personalSyncProgress.processed / personalSyncProgress.total) * 100)
        : 0;

    // Cap at 99% while syncing to indicate work in progress
    const displayPercentage = (busy && percentage >= 100) ? 99 : percentage;
    const displayPersonalPercentage = (personalSyncBusy && personalPercentage >= 100) ? 99 : personalPercentage;

    return {
        sync: requestSync,
        busy,
        lastSynced,
        duration,
        logs,
        percentage: displayPercentage,
        startTime,
        personalSyncBusy,
        personalSyncError,
        personalSyncProgress,
        personalSyncPercentage: displayPersonalPercentage
    };
}

export function useSync(options = {}) {
    const { active = true } = options;
    const online = useOnline();
    const isSignedIn = Cookies.get("id") && Cookies.get("hash");
    const isVisible = usePageVisibility();
    const { busy } = SyncActiveStore.useState(s => ({ busy: s.busy }));
    const [counter, setCounter] = useState(0);
    const timerRef = useRef(null);

    useEffect(() => {
        if (!active || !online || !isSignedIn || !isVisible) {
            return;
        }

        const checkSync = () => {
            const now = Date.now();
            const lastSyncTime = SyncActiveStore.getRawState().lastSyncTime;
            const timeSinceLastSync = (now - lastSyncTime) / 1000;
            const sessionsBusy = UpdateSessionsStore.getRawState().busy;

            if (timeSinceLastSync >= SYNC_INTERVAL && !busy && !sessionsBusy) {
                requestSync();
            }
        };

        // Only sync immediately if we've NEVER synced before (fresh session)
        const lastSyncTime = SyncActiveStore.getRawState().lastSyncTime;
        if (lastSyncTime === 0) {
            const sessionsBusy = UpdateSessionsStore.getRawState().busy;
            if (!sessionsBusy) {
                requestSync();
            }
        }

        timerRef.current = setInterval(checkSync, 10000);

        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
        };
    }, [active, online, isSignedIn, isVisible, busy]);

    useEffect(() => {
        const unsubscribe = SyncActiveStore.subscribe(
            s => s.counter,
            newCounter => setCounter(newCounter)
        );
        return unsubscribe;
    }, []);

    return [counter, busy];
}



export async function clearBundleCache() {
    try {
        addSyncLog('Clearing all sync data...', "warning");
        await storage.deleteFolder(LOCAL_SYNC_PATH);
        SyncActiveStore.update(s => {
            s.lastSynced = 0;
            s.counter = 0;
            s.busy = false;
            s.logs = [];
        });
        addSyncLog('✓ All sync data cleared', "success");
    } catch (err) {
        console.error("[Sync] Error clearing cache:", err);
    }
}

export { addSyncLog };
