import { useRef, useEffect, useState, useCallback } from "react";
import { Store } from "pullstate";
import { fetchJSON } from "@util/fetch";
import storage from "@util/storage";
import Cookies from "js-cookie";
import { useOnline } from "@util/online";
import { makePath } from "@util/path";
import * as bundle from "./bundle";
import { usePageVisibility } from "@util/hooks";

export const SyncActiveStore = new Store({
    active: 0,
    counter: 0,
    busy: false,
    lastSynced: 0,
    progress: { total: 0, processed: 0 },
    currentBundle: null  // Track which bundle is currently being synced
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

    const visible = usePageVisibility();
    const { active, busy, progress } = SyncActiveStore.useState();
    const currentBundle = SyncActiveStore.useState(s => s.currentBundle);
    const isSignedIn = Cookies.get("id") && Cookies.get("hash");
    const updateSync = useCallback(async (pollSync) => {
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
                // - MongoDB (personal) for per-user data (read/write for all)
                // - S3 (aws/metadata/shared) for shared metadata (read-only for non-admins)
                // - S3 (aws/metadata/shared/sessions) for ALL session data (consolidated)
                const bundles = [
                    {
                        name: "personal",
                        path: makePath("local", "personal")
                    },
                    {
                        name: "aws/metadata/shared",  // S3 - shared metadata (read-only for non-admins)
                        path: makePath("local", "shared"),
                        ignore: ["sessions"]
                    },
                    {
                        name: "aws/metadata/shared/sessions",  // S3 - ALL sessions consolidated
                        path: makePath("local", "shared", "sessions")
                    }
                ];

                // Consolidated sessions bundle automatically handles all groups
                // - Adding new groups: new files under sessions/{group}/ are included
                // - Removing groups: deleted files trigger bundle update
                // - Modifying groups: any file changes trigger bundle update



                SyncActiveStore.update(s => {
                    s.progress = { total: bundles.length, processed: 0 };
                });

                // 3. Define Sync Task
                const runTask = async (bundleDef) => {
                    const { name, path, ignore } = bundleDef;
                    const startTime = Date.now();
                    try {
                        let localUpdated = false;

                        // Update current bundle being synced
                        SyncActiveStore.update(s => {
                            s.currentBundle = name;
                        });

                        // OPTIMIZATION: Check version first - skip processing if unchanged
                        const t1 = Date.now();
                        const { changed } = await bundle.checkBundleVersion(name);
                        console.log(`[Sync] ${name} - Version check: ${Date.now() - t1}ms, changed: ${changed}`);

                        if (!changed) {
                            // Bundle hasn't changed - skip all processing
                            return;
                        }

                        // Only scan local directories if bundle has changed
                        const t2 = Date.now();
                        const bundleListing = await storage.getRecursiveList(path);
                        console.log(`[Sync] ${name} - Directory scan: ${Date.now() - t2}ms, files: ${bundleListing.length}`);

                        // Download & Apply
                        const t3 = Date.now();
                        const remoteBundle = await bundle.getRemoteBundle(name);
                        console.log(`[Sync] ${name} - Download bundle: ${Date.now() - t3}ms`);

                        const t4 = Date.now();
                        const { downloadCount, listing: updatedListing } = await bundle.applyBundle(path, remoteBundle, bundleListing);
                        console.log(`[Sync] ${name} - Apply bundle: ${Date.now() - t4}ms, downloaded: ${downloadCount}`);

                        // Upload & Merge
                        const t5 = Date.now();
                        const localBundle = await bundle.scanLocal(path, ignore, updatedListing, remoteBundle);
                        console.log(`[Sync] ${name} - Scan local: ${Date.now() - t5}ms`);

                        const t6 = Date.now();
                        const { merged, updated } = bundle.mergeBundles(remoteBundle || {}, localBundle, name);
                        console.log(`[Sync] ${name} - Merge bundles: ${Date.now() - t6}ms, updated: ${updated}`);

                        if (updated) {
                            const t7 = Date.now();
                            await bundle.saveRemoteBundle(name, merged);
                            console.log(`[Sync] ${name} - Save bundle: ${Date.now() - t7}ms`);
                            localUpdated = true;
                        }

                        if (downloadCount > 0 || localUpdated) {
                            updateCounter++;
                        }

                        console.log(`[Sync] ${name} - Total time: ${Date.now() - startTime}ms`);
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
        updateSync(pollSync);
    }, [updateSync]);
    useEffect(() => {
        if (online && isSignedIn) {
            const timerHandle = setTimeout(() => {
                syncNow(true);
            }, 1000);
            return () => clearTimeout(timerHandle);
        }
    }, [online, isSignedIn, visible, syncNow]);

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
        sync: online && syncNow,
        busy,
        error,
        active,
        duration,
        complete,
        changed,
        progress,
        percentage,
        currentBundle
    };
}
