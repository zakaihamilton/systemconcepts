import { useRef, useEffect, useState, useCallback } from "react";
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

const SYNC_INTERVAL = 60; // seconds

/**
 * Main sync function
 */
export async function performSync() {
    const unlock = await lockMutex({ id: "sync_process" });
    addSyncLog("Starting sync process...", "info");
    const startTime = performance.now();
    let hasChanges = false;

    try {
        // Step 1
        const localFiles = await getLocalFiles();

        // Step 2
        let localManifest = await updateLocalManifest(localFiles);

        // Step 3
        let remoteManifest = await syncManifest(localManifest);

        // Step 4
        const downloadResult = await downloadUpdates(localManifest, remoteManifest);
        localManifest = downloadResult.manifest;
        remoteManifest = downloadResult.cleanedRemoteManifest || remoteManifest;
        hasChanges = hasChanges || downloadResult.hasChanges;

        // Step 4.5: Remove files that were deleted on remote
        const removeResult = await removeDeletedFiles(localManifest, remoteManifest);
        localManifest = removeResult.manifest;
        hasChanges = hasChanges || removeResult.hasChanges;

        // Step 5
        const uploadUpdatesResult = await uploadUpdates(localManifest, remoteManifest);
        remoteManifest = uploadUpdatesResult.manifest;
        hasChanges = hasChanges || uploadUpdatesResult.hasChanges;

        // Step 6
        const uploadNewResult = await uploadNewFiles(localManifest, remoteManifest);
        remoteManifest = uploadNewResult.manifest;
        hasChanges = hasChanges || uploadNewResult.hasChanges;

        // Step 7
        await uploadManifest(remoteManifest);

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

    } catch (err) {
        console.error("[Sync] Sync failed:", err);
        addSyncLog(`Sync failed: ${err.message}`, "error");
        throw err;
    } finally {
        unlock();
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
        progress: s.progress
    }));

    const { busy, lastSynced, logs, lastDuration: duration, startTime, progress } = state;

    const percentage = progress && progress.total > 0
        ? Math.round((progress.processed / progress.total) * 100)
        : 0;

    return {
        sync: requestSync,
        busy,
        lastSynced,
        duration,
        logs,
        percentage,
        startTime
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
