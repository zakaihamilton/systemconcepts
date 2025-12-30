import { useRef, useEffect, useState, useCallback } from "react";
import { fetchJSON } from "@util/fetch";
import storage from "@util/storage";
import Cookies from "js-cookie";
import { useOnline } from "@util/online";
import { makePath } from "@util/path";
import * as bundle from "./bundle";
import { flushManifestUpdates } from "./bundle";
import { usePageVisibility } from "@util/hooks";
import { SyncActiveStore, UpdateSessionsStore } from "./syncState";

const SYNC_INTERVAL = 60; // seconds
const MIN_GROUPS_FOR_S3_SCAN = 5;
const SYNC_CONCURRENCY_LIMIT = 10;

export async function clearBundleCache() {
    try {
        await storage.deleteFolder("local/cache");
        SyncActiveStore.update(s => {
            s.lastSynced = 0;
            s.progress = { total: 0, processed: 0 };
        });
        console.log('[Sync] Bundle cache cleared');
    } catch (err) {
        console.error('[Sync] Error clearing bundle cache:', err);
    }
}

export function useSync(options = {}) {
    const { active = true } = options;
    const { counter, busy } = SyncActiveStore.useState(s => ({
        counter: s.counter,
        busy: s.busy
    }));

    useEffect(() => {
        if (active) {
            SyncActiveStore.update(s => { s.active++; });
            return () => SyncActiveStore.update(s => { s.active--; });
        }
    }, [active]);

    return [counter, busy];
}

async function discoverGroups(sessionPath) {
    let groups = [];

    try {
        const listingPath = makePath(sessionPath, "listing.json");
        if (await storage.exists(listingPath)) {
            const listingBody = await storage.readFile(listingPath);
            try {
                groups = JSON.parse(listingBody) || [];
            } catch (e) {
                console.error("[Sync] Failed to parse listing.json:", e);
            }
        }

        if (await storage.exists(sessionPath)) {
            const items = await storage.getListing(sessionPath);
            const localGroups = items
                .filter(item => item.type === "dir" || item.stat?.type === "dir")
                .map(item => ({ name: item.name }));

            for (const lg of localGroups) {
                if (!groups.find(g => g.name === lg.name)) {
                    groups.push(lg);
                }
            }
        }

        if (groups.length < MIN_GROUPS_FOR_S3_SCAN) {
            console.log("[Sync] Discovering groups from S3...");
            const remoteItems = await storage.getListing("aws/metadata/sessions") || [];
            const discoveredGroups = remoteItems
                .filter(item => item.type === "dir" || item.stat?.type === "dir")
                .map(item => ({ name: item.name }))
                .filter(g => g.name !== "bundle.gz" && !g.name.startsWith("bundle.gz.part"));

            for (const dg of discoveredGroups) {
                if (!groups.find(g => g.name === dg.name)) {
                    groups.push(dg);
                }
            }
            console.log(`[Sync] Found ${groups.length} groups:`, groups.map(g => g.name).join(", "));
        }
    } catch (err) {
        console.error("[Sync] Failed to discover groups:", err);
    }

    return groups;
}

function createBundles(groups) {
    return [
        {
            name: "personal",
            path: makePath("local", "personal")
        },
        {
            name: "aws/metadata",
            path: makePath("local", "shared"),
            ignore: groups.map(g => `sessions/${g.name}`)
        },
        ...groups.map(group => ({
            name: `aws/metadata/sessions/${group.name}`,
            path: makePath("local", "shared", "sessions", group.name),
            preserve: ["tags.json", "listing.json", "metadata.json"]
        }))
    ];
}

async function syncBundle(bundleDef) {
    const { name, path, ignore, preserve } = bundleDef;
    const startTime = Date.now();

    try {
        SyncActiveStore.update(s => { s.currentBundle = name; });

        // Step 1: Quick version check using bundle metadata
        const t1 = Date.now();
        const { changed, versionInfo, listing: remoteListing } = await bundle.checkBundleVersion(name);
        console.log(`[Sync] ${name} - Version check: ${Date.now() - t1}ms, changed: ${changed}`);

        // OPTIMIZATION: If bundle hasn't changed remotely, skip all expensive operations
        if (!changed) {
            console.log(`[Sync] ${name} - No remote changes, skipping sync (${Date.now() - startTime}ms)`);
            return false;
        }

        // Step 2: Only scan directory if we detected changes
        const t2 = Date.now();
        const bundleListing = await storage.getRecursiveList(path);
        console.log(`[Sync] ${name} - Directory scan: ${Date.now() - t2}ms, files: ${bundleListing.length}`);

        const t3 = Date.now();
        let remoteBundle = await bundle.getRemoteBundle(name, remoteListing);
        console.log(`[Sync] ${name} - Download bundle: ${Date.now() - t3}ms`);

        const isBundleCorrupted = remoteBundle && Object.values(remoteBundle).some(item => item.content == null);
        if (isBundleCorrupted) {
            console.warn(`[Sync] ${name} - Remote bundle corrupted`);
        }

        const t5 = Date.now();
        const localBundle = await bundle.scanLocal(
            path,
            ignore,
            isBundleCorrupted ? null : bundleListing,
            isBundleCorrupted ? null : remoteBundle
        );
        console.log(`[Sync] ${name} - Scan local: ${Date.now() - t5}ms`);

        const t6 = Date.now();
        const { merged, updated } = bundle.mergeBundles(remoteBundle || {}, localBundle, name);
        console.log(`[Sync] ${name} - Merge bundles: ${Date.now() - t6}ms, updated: ${updated}`);

        let localUpdated = false;
        if (updated || (isBundleCorrupted && Object.keys(merged).length > 0)) {
            const t7 = Date.now();
            await bundle.saveRemoteBundle(name, merged);
            console.log(`[Sync] ${name} - Save bundle: ${Date.now() - t7}ms`);
            localUpdated = true;
        }

        const t4 = Date.now();
        const { downloadCount, isBundleCorrupted: appliedCorruption } = await bundle.applyBundle(
            path,
            merged,
            isBundleCorrupted ? null : bundleListing,
            ignore,
            preserve
        );

        if (appliedCorruption) {
            console.warn(`[Sync] ${name} - Bundle application detected corruption`);
        } else {
            console.log(`[Sync] ${name} - Apply bundle: ${Date.now() - t4}ms, downloaded: ${downloadCount}`);
        }

        const hasChanges = downloadCount > 0 || localUpdated;
        console.log(`[Sync] ${name} - Total time: ${Date.now() - startTime}ms`);
        return hasChanges;
    } catch (err) {
        console.error(`[Sync] Error syncing bundle ${name}:`, err);
        throw err;
    } finally {
        SyncActiveStore.update(s => { s.progress.processed++; });
    }
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

        startRef.current = Date.now();
        setComplete(false);
        setDuration(0);
        setError(null);
        setChanged(false);

        const currentTime = Date.now();
        const isSignedIn = Cookies.get("id") && Cookies.get("hash");
        let continueSync = true;

        SyncActiveStore.update(s => {
            s.progress = { total: 0, processed: 0 };
            const diff = (currentTime - s.lastSynced) / 1000;
            const updateBusy = UpdateSessionsStore.getRawState().busy;

            if (pollSync && s.lastSynced && diff < SYNC_INTERVAL) {
                continueSync = false;
            } else if (updateBusy) {
                console.log("[Sync] Session update in progress, skipping sync");
                continueSync = false;
            } else {
                s.busy = true;
            }
        });

        if (!continueSync) {
            startRef.current = 0;
            return;
        }

        try {
            if (!isSignedIn) {
                return;
            }

            const sessionPath = makePath("local", "shared", "sessions");
            const groups = await discoverGroups(sessionPath);
            const bundles = createBundles(groups);

            SyncActiveStore.update(s => {
                s.progress = { total: bundles.length, processed: 0 };
            });

            const limit = (await import("p-limit")).default(SYNC_CONCURRENCY_LIMIT);
            const results = await Promise.all(bundles.map(b =>
                limit(async () => {
                    try {
                        return await syncBundle(b);
                    } catch (err) {
                        if (err === 403) {
                            setError("ACCESS_DENIED");
                        } else {
                            setError("SYNC_FAILED");
                        }
                        return false;
                    }
                })
            ));

            const updateCounter = results.filter(Boolean).length;

            if (updateCounter > 0) {
                SyncActiveStore.update(s => {
                    s.counter++;
                    s.lastSynced = currentTime;
                    s.waitForApproval = false;
                });
                setChanged(true);
            } else {
                SyncActiveStore.update(s => {
                    s.lastSynced = currentTime;
                });
            }
        } finally {
            // Ensure all pending manifest updates are written before finishing
            await flushManifestUpdates();

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

    useEffect(() => {
        if (!busy || !startRef.current) return;

        const intervalHandle = setInterval(() => {
            setDuration(Date.now() - startRef.current);
        }, 100);

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
