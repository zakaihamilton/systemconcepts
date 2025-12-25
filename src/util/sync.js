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
                // 1. Define Bundles
                const bundles = [
                    {
                        name: "personal",
                        path: makePath("local", "personal")
                    },
                    {
                        name: "shared/bundles/meta",
                        path: makePath("local", "shared"),
                        ignore: ["sessions"]
                    }
                ];

                // 2. Add Dynamic Group Bundles
                try {
                    const groupsPath = makePath("local", "shared", "groups.json");
                    if (await storage.exists(groupsPath)) {
                        const groupsContent = await storage.readFile(groupsPath);
                        const groups = JSON.parse(groupsContent);
                        for (const group of groups) {
                            if (group.name) {
                                bundles.push({
                                    name: `shared/bundles/sessions/${group.name}`,
                                    path: makePath("local", "shared", "sessions", group.name)
                                });
                            }
                        }
                    }
                } catch (err) {
                    console.error("Error loading groups for sync:", err);
                }



                SyncActiveStore.update(s => {
                    s.progress = { total: bundles.length, processed: 0 };
                });

                // 3. Pre-scan local directories
                const personalRoot = makePath("local", "personal");
                const sharedRoot = makePath("local", "shared");
                const [personalListing, sharedListing] = await Promise.all([
                    storage.getRecursiveList(personalRoot),
                    storage.getRecursiveList(sharedRoot)
                ]);
                const fullLocalListing = [...personalListing, ...sharedListing];

                // 4. Define Sync Task
                const runTask = async (bundleDef) => {
                    const { name, path, ignore } = bundleDef;
                    const startTime = Date.now();
                    try {
                        let localUpdated = false;

                        // Filter the pre-scanned listing for this bundle's path
                        const normalizedPath = path.endsWith("/") ? path : path + "/";
                        const bundleListing = fullLocalListing.filter(item =>
                            item.path === path || item.path.startsWith(normalizedPath));
                        const t1 = Date.now();

                        // Download & Apply
                        const remoteBundle = await bundle.getRemoteBundle(name);
                        const { downloadCount, listing: updatedListing } = await bundle.applyBundle(path, remoteBundle, bundleListing);

                        // Upload & Merge
                        const localBundle = await bundle.scanLocal(path, ignore, updatedListing, remoteBundle);
                        const { merged, updated } = bundle.mergeBundles(remoteBundle || {}, localBundle, name);

                        if (updated) {
                            await bundle.saveRemoteBundle(name, merged);
                            localUpdated = true;
                        }

                        if (downloadCount > 0 || localUpdated) {
                            updateCounter++;
                        }
                    } catch (err) {
                        console.error(`Error syncing bundle ${name}:`, err);
                        if (err === 403) {
                            setError("ACCESS_DENIED");
                        } else {
                            setError("SYNC_FAILED");
                        }
                    } finally {
                        SyncActiveStore.update(s => {
                            s.progress.processed++;
                        });
                    }
                };

                // 5. Execute concurrently
                const limit = (await import("p-limit")).default(10);
                await Promise.all(bundles.map(b => limit(() => runTask(b))));
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
