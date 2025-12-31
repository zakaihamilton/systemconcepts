import { useRef, useEffect, useState, useCallback } from "react";
import storage from "@util/storage";
import Cookies from "js-cookie";
import { useOnline } from "@util/online";

import { usePageVisibility } from "@util/hooks";
import { SyncActiveStore } from "@sync/syncState";
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

const SYNC_INTERVAL = 60; // seconds

/**
 * Main sync function
 */
export async function performSync() {
    const unlock = await lockMutex({ id: "sync_process" });
    addSyncLog("Starting sync process...", "info");
    const startTime = performance.now();

    try {
        // Step 1
        const localFiles = await getLocalFiles();

        // Step 2
        let localManifest = await updateLocalManifest(localFiles);

        // Step 3
        let remoteManifest = await syncManifest(localManifest);

        // Step 4
        localManifest = await downloadUpdates(localManifest, remoteManifest);

        // Step 5
        remoteManifest = await uploadUpdates(localManifest, remoteManifest);

        // Step 6
        await uploadNewFiles(localManifest, remoteManifest);

        const duration = ((performance.now() - startTime) / 1000).toFixed(1);
        addSyncLog(`Sync complete in ${duration}s`, "success");

        // Trigger reload
        SyncActiveStore.update(s => {
            s.needsSessionReload = true;
        });

    } catch (err) {
        console.error("[Sync] Sync failed:", err);
        addSyncLog(`Sync failed: ${err.message}`, "error");
        throw err;
    } finally {
        unlock();
    }
}

export function useSyncFeature() {
    const [lastSynced, setLastSynced] = useState(0);
    const [busy, setBusy] = useState(false);
    const [percentage, setPercentage] = useState(0);
    const [duration, setDuration] = useState(0);
    const [logs, setLogs] = useState([]);

    useEffect(() => {
        const unsubscribe = SyncActiveStore.subscribe(
            s => s,
            state => {
                setBusy(state.busy);
                setLastSynced(state.lastSynced);
                setLogs(state.logs || []);
                setDuration(state.lastDuration);
            }
        );
        return unsubscribe;
    }, []);

    const sync = useCallback(async () => {
        const isBusy = SyncActiveStore.getRawState().busy;
        if (isBusy) return;

        SyncActiveStore.update(s => {
            s.busy = true;
            s.startTime = Date.now();
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
    }, []);

    return {
        sync,
        busy,
        lastSynced,
        duration,
        logs,
        percentage
    };
}

export function useSync(options = {}) {
    const { active = true } = options;
    const online = useOnline();
    const isSignedIn = Cookies.get("id") && Cookies.get("hash");
    const isVisible = usePageVisibility();
    const { sync, busy } = useSyncFeature();
    const [counter, setCounter] = useState(0);
    const lastSyncRef = useRef(0);
    const timerRef = useRef(null);

    useEffect(() => {
        if (!active || !online || !isSignedIn || !isVisible) {
            return;
        }

        const checkSync = () => {
            const now = Date.now();
            const timeSinceLastSync = (now - lastSyncRef.current) / 1000;

            if (timeSinceLastSync >= SYNC_INTERVAL && !busy) {
                lastSyncRef.current = now;
                sync();
            }
        };

        if (lastSyncRef.current === 0) {
            lastSyncRef.current = Date.now();
            sync();
        }

        timerRef.current = setInterval(checkSync, 10000);

        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
        };
    }, [active, online, isSignedIn, isVisible, sync, busy]);

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
