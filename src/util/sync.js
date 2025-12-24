import { useRef, useEffect, useState, useCallback } from "react";
import { Store } from "pullstate";
import { fetchJSON } from "@util/fetch";
import { useLocalStorage } from "@util/store";
import storage from "@util/storage";
import Cookies from "js-cookie";
import { useOnline } from "@util/online";
import { makePath } from "@util/path";
import * as bundle from "./bundle";
import { usePageVisibility } from "@util/hooks";

export const SyncStore = new Store({
    lastUpdated: 0
});

export const SyncActiveStore = new Store({
    active: 0,
    counter: 0,
    busy: false,
    lastSynced: 0,
    progress: { total: 0, processed: 0 }
});

export function useSync(options = {}) {
    const { active = true } = options;
    const { counter, busy } = SyncActiveStore.useState(s => {
        return {
            counter: s.counter,
            busy: s.busy
        };
    });
    useEffect(() => {
        if (active) {
            SyncActiveStore.update(s => {
                s.active++;
            });
            return () => {
                SyncActiveStore.update(s => {
                    s.active--;
                });
            };
        }
    }, [active]);
    return [counter, busy];
}



export function useSyncFeature() {
    const startRef = useRef(null);
    const [duration, setDuration] = useState(0);
    const [complete, setComplete] = useState(false);
    const [changed, setChanged] = useState(false);
    const online = useOnline();
    const [error, setError] = useState(null);
    const { lastUpdated, _loaded } = SyncStore.useState();
    useLocalStorage("sync", SyncStore);
    const visible = usePageVisibility();
    const { active, busy, progress } = SyncActiveStore.useState();
    const isSignedIn = Cookies.get("id") && Cookies.get("hash");
    const updateSync = useCallback(async (pollSync, lastUpdated) => {
        if (startRef.current || !online) {
            return;
        }
        startRef.current = new Date().getTime();
        setComplete(false);
        setDuration(0);
        setError(null);
        setChanged(false);
        const currentTime = new Date().getTime();
        const isSignedIn = Cookies.get("id") && Cookies.get("hash");
        let continueSync = true;
        SyncActiveStore.update(s => {
            s.progress = { total: 0, processed: 0 };
            const diff = (currentTime - s.lastSynced) / 1000;
            if (pollSync && s.lastSynced && diff < 60) {
                continueSync = false;
            }
            else {
                s.busy = true;
            }
        });
        if (!continueSync) {
            startRef.current = 0;
            return;
        }

        try {


            let updateCounter = 0;
            if (isSignedIn) {
                // Bundles: Shared + Personal
                const totalItems = 2;
                console.log("Total items to sync:", totalItems);
                SyncActiveStore.update(s => {
                    s.progress = { total: totalItems, processed: 0 };
                });

                // Now process the items
                try {
                    console.log("Syncing shared bundle...");
                    // Download & Apply (Sync Items)
                    const remoteBundle = await bundle.getRemoteBundle("shared");
                    let downloadedCount = 0;
                    if (remoteBundle) {
                        downloadedCount = await bundle.applyBundle(makePath("local", "shared"), remoteBundle);
                    }

                    // Upload & Merge (Sync Local)
                    const localBundle = await bundle.scanLocal(makePath("local", "shared"));
                    const { merged, updated } = bundle.mergeBundles(remoteBundle || {}, localBundle);
                    if (updated) {
                        await bundle.saveRemoteBundle("shared", merged);
                    }

                    if (downloadedCount > 0 || updated) {
                        updateCounter++;
                    }
                    SyncActiveStore.update(s => {
                        s.progress.processed++;
                    });
                }
                catch (err) {
                    updateCounter--;
                    if (err === 403) {
                        setError("ACCESS_DENIED");
                    }
                    else {
                        setError("SYNC_FAILED");
                    }
                    console.error(err);
                }
                try {
                    console.log("Syncing personal bundle...");
                    // Download & Apply (Sync Items)
                    const remoteBundle = await bundle.getRemoteBundle("personal");
                    let downloadedCount = 0;
                    if (remoteBundle) {
                        downloadedCount = await bundle.applyBundle(makePath("local", "personal"), remoteBundle);
                    }

                    // Upload & Merge (Sync Local)
                    const localBundle = await bundle.scanLocal(makePath("local", "personal"));
                    // If no remote bundle (first run/migration), treat as empty
                    const { merged, updated } = bundle.mergeBundles(remoteBundle || {}, localBundle);
                    if (updated) {
                        await bundle.saveRemoteBundle("personal", merged);
                    }

                    if (downloadedCount > 0 || updated) {
                        updateCounter++;
                    }
                    SyncActiveStore.update(s => {
                        s.progress.processed++;
                    });
                }
                catch (err) {
                    updateCounter--;
                    if (err === 403) {
                        setError("ACCESS_DENIED");
                    }
                    else {
                        setError("SYNC_FAILED");
                    }
                    console.error(err);
                }
            }
            if (updateCounter > 0) {
                SyncStore.update(s => {
                    s.lastUpdated = currentTime;
                });
                SyncActiveStore.update(s => {
                    s.counter++;
                    s.lastSynced = currentTime;
                    s.waitForApproval = false;
                });
                setChanged(true);
            }
            else {
                SyncActiveStore.update(s => {
                    s.lastSynced = currentTime;
                });
            }
        }
        finally {
            // Always cleanup, even if an error occurred
            startRef.current = 0;
            SyncActiveStore.update(s => {
                s.busy = false;
            });
            setComplete(true);
        }
    }, [online]);
    const fullSync = useCallback(async () => {
        SyncStore.update(s => {
            s.lastUpdated = 0;
        });
        SyncActiveStore.update(s => {
            s.lastSynced = 0;
        });
        updateSync(false, 0);
    }, [updateSync]);
    const syncNow = useCallback(pollSync => {
        updateSync(pollSync, lastUpdated);
    }, [lastUpdated, updateSync]);
    useEffect(() => {
        if (online && _loaded && isSignedIn) {
            const timerHandle = setTimeout(() => {
                syncNow(true);
            }, 1000);
            return () => clearTimeout(timerHandle);
        }
    }, [online, _loaded, isSignedIn, visible, syncNow]);

    // Update duration continuously while syncing
    useEffect(() => {
        if (!busy || !startRef.current) {
            return;
        }
        const intervalHandle = setInterval(() => {
            const currentDuration = new Date().getTime() - startRef.current;
            setDuration(currentDuration);
        }, 100); // Update every 100ms for smooth updates
        return () => clearInterval(intervalHandle);
    }, [busy]);

    const percentage = progress.total > 0 ? Math.round((progress.processed / progress.total) * 100) : 0;

    return {
        sync: online && _loaded && syncNow,
        fullSync: online && _loaded && fullSync,
        busy,
        error,
        active,
        duration,
        complete,
        changed,
        progress,
        percentage
    };
}
