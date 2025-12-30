import { useRef, useEffect, useState, useCallback } from "react";
import { useLocalStorage } from "@util/store";
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
const DATA_STRUCTURE_VERSION = 3; // Increment when data structure changes - v3: listing.json no longer preserved
const VERSION_KEY = "local/cache/_data_version.json";

export function addSyncLog(message, type = "info") {
    SyncActiveStore.update(s => {
        s.logs = [...(s.logs || []), {
            id: Date.now() + Math.random(),
            timestamp: Date.now(),
            message,
            type
        }].slice(-100); // Keep last 100 logs
    });
}

async function checkAndMigrateDataStructure() {
    try {
        let currentVersion = 0;

        // Check existing version
        if (await storage.exists(VERSION_KEY)) {
            const versionData = await storage.readFile(VERSION_KEY);
            try {
                const parsed = JSON.parse(versionData);
                currentVersion = parsed.version || 0;
            } catch (e) {
                console.warn('[Sync] Invalid version file, treating as version 0');
            }
        }

        // If version mismatch, clear old data
        if (currentVersion !== DATA_STRUCTURE_VERSION) {
            addSyncLog(`Data structure mismatch (v${currentVersion} vs v${DATA_STRUCTURE_VERSION}). Migrating...`, "warning");

            try {
                // Clear all cached data
                await storage.deleteFolder("local/cache");
                await storage.deleteFolder("local/shared/sessions");

                // Reset sync state
                SyncActiveStore.update(s => {
                    s.lastSynced = 0;
                    s.progress = { total: 0, processed: 0 };
                });

                // Save new version
                await storage.createFolderPath(VERSION_KEY);
                await storage.writeFile(VERSION_KEY, JSON.stringify({
                    version: DATA_STRUCTURE_VERSION,
                    timestamp: Date.now()
                }));

                addSyncLog('Migration completed successfully.', "success");
                return true; // Indicates migration occurred
            } catch (migrationErr) {
                addSyncLog(`Migration failed: ${migrationErr.message}`, "error");
                return false;
            }
        }

        return false; // No migration needed
    } catch (err) {
        console.error('[Sync] Error checking data structure version:', err);
        return false;
    }
}

export async function clearBundleCache() {
    try {
        addSyncLog('Full sync started...', "warning");

        // Clear all cached bundle data
        await storage.deleteFolder("local/cache");

        // Clear all session data
        await storage.deleteFolder("local/shared/sessions");

        // Clear personal data cache
        await storage.deleteFolder("local/personal");

        // Reset sync state completely
        SyncActiveStore.update(s => {
            s.lastSynced = 0;
            s.progress = { total: 0, processed: 0 };
            s.counter = 0;
            s.busy = false;
            s.currentBundle = null;
            s.logs = [];
            s.lastDuration = 0;
        });

        // Reset update sessions state
        UpdateSessionsStore.update(s => {
            s.busy = false;
            s.status = [];
            s.start = 0;
        });

        // Initialize the data version file after clearing
        await storage.createFolderPath(VERSION_KEY);
        await storage.writeFile(VERSION_KEY, JSON.stringify({
            version: DATA_STRUCTURE_VERSION,
            timestamp: Date.now()
        }));

        addSyncLog('Full sync initialized successfully.', "success");
        return true;
    } catch (err) {
        addSyncLog(`Error clearing cache: ${err.message}`, "error");
        return false;
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
            addSyncLog("Discovering groups from server...", "info");
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
            addSyncLog(`Found ${groups.length} groups.`, "success");
        }
    } catch (err) {
        addSyncLog(`Failed to discover groups: ${err.message}`, "error");
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
            preserve: ["tags.json", "metadata.json"]
        }))
    ];
}

async function syncBundle(bundleDef, manifest) {
    const { name, path, ignore, preserve } = bundleDef;
    const startTime = performance.now();
    const shortName = name.split('/').pop();

    try {
        SyncActiveStore.update(s => { s.currentBundle = name; });

        // Step 1: Quick version check using bundle metadata
        const { changed, versionInfo, listing: remoteListing } = await bundle.checkBundleVersion(name, null, manifest);

        // OPTIMIZATION: If bundle hasn't changed remotely, skip all expensive operations
        if (!changed) {
            const duration = Math.round(performance.now() - startTime);
            addSyncLog(`[${shortName}] Up to date (${duration}ms).`, "info");
            return false;
        }

        addSyncLog(`[${shortName}] Syncing changes...`, "info");
        const workStartTime = performance.now();

        // Step 2: Only scan directory if we detected changes
        const bundleListing = await storage.getRecursiveList(path);
        let remoteBundle = await bundle.getRemoteBundle(name, remoteListing);

        const isBundleCorrupted = remoteBundle && Object.values(remoteBundle).some(item => item.content == null);
        if (isBundleCorrupted) {
            addSyncLog(`[${shortName}] Remote bundle corrupted.`, "warning");
        }

        const localBundle = await bundle.scanLocal(
            path,
            ignore,
            isBundleCorrupted ? null : bundleListing,
            isBundleCorrupted ? null : remoteBundle
        );

        const { merged, updated } = bundle.mergeBundles(remoteBundle || {}, localBundle, name);

        let localUpdated = false;
        if (updated || (isBundleCorrupted && Object.keys(merged).length > 0)) {
            await bundle.saveRemoteBundle(name, merged);
            localUpdated = true;
        }

        const { downloadCount, isBundleCorrupted: appliedCorruption } = await bundle.applyBundle(
            path,
            merged,
            isBundleCorrupted ? null : bundleListing,
            ignore,
            preserve
        );

        if (appliedCorruption) {
            addSyncLog(`[${shortName}] Sync issues detected.`, "warning");
        } else {
            const sessionIds = [...new Set(Object.keys(merged || {})
                .map(p => p.split('/')[0])
                .filter(p => p && !p.includes('.') && p !== "listing.json" && p !== "metadata.json" && p !== "tags.json")
            )].sort();
            const lastSession = sessionIds[sessionIds.length - 1];
            const lastSessionMsg = lastSession ? `, last: ${lastSession}` : "";
            const duration = Math.round(performance.now() - workStartTime);
            addSyncLog(`[${shortName}] ✓ Done (${downloadCount} files${lastSessionMsg} in ${duration}ms).`, "success");
        }

        const hasChanges = downloadCount > 0 || localUpdated;
        return hasChanges;
    } catch (err) {
        addSyncLog(`[${shortName}] Failed: ${err.message}`, "error");
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
    const { active, busy, progress, lastSynced, logs, lastDuration, startTime } = SyncActiveStore.useState();
    useLocalStorage("sync_active", SyncActiveStore, ["lastSynced", "lastDuration", "startTime"]);
    const currentBundle = SyncActiveStore.useState(s => s.currentBundle);
    const isSignedIn = Cookies.get("id") && Cookies.get("hash");

    const updateSync = useCallback(async (pollSync) => {
        if (startRef.current || SyncActiveStore.getRawState().busy || !online) {
            return;
        }

        const currentTime = Date.now();
        const isSignedIn = Cookies.get("id") && Cookies.get("hash");

        // Early return checks before setting any state
        if (!isSignedIn) {
            return;
        }

        let continueSync = true;
        SyncActiveStore.update(s => {
            const diff = (currentTime - s.lastSynced) / 1000;
            const updateBusy = UpdateSessionsStore.getRawState().busy;

            if (pollSync && s.lastSynced && diff < SYNC_INTERVAL) {
                continueSync = false;
            } else if (updateBusy) {
                console.log("[Sync] Session update in progress, skipping sync");
                continueSync = false;
            }
        });

        if (!continueSync) {
            return;
        }

        // Now we're committed to syncing - set state
        const syncStartTime = Date.now();
        startRef.current = syncStartTime;
        SyncActiveStore.update(s => {
            s.busy = true;
            s.startTime = syncStartTime;
            s.progress = { total: 0, processed: 0 };
        });
        setComplete(false);
        setDuration(0);
        setError(null);
        setChanged(false);

        // Reset logs for new sync if it's a manual sync or a significant one
        SyncActiveStore.update(s => { s.logs = []; });
        addSyncLog("Synchronization started...", "info");

        let syncSucceeded = false;
        try {
            // Check for data structure version and migrate if needed
            const wasMigrated = await checkAndMigrateDataStructure();

            const sessionPath = makePath("local", "shared", "sessions");
            const groups = await discoverGroups(sessionPath);
            const bundles = createBundles(groups);

            SyncActiveStore.update(s => {
                s.progress = { total: bundles.length, processed: 0 };
            });

            addSyncLog(`Syncing ${bundles.length} data bundles.`, "info");

            const masterManifest = await bundle.getMasterManifest();
            const limit = (await import("p-limit")).default(SYNC_CONCURRENCY_LIMIT);
            const results = await Promise.all(bundles.map(b =>
                limit(async () => {
                    try {
                        return await syncBundle(b, masterManifest);
                    } catch (err) {
                        return false;
                    }
                })
            ));

            const updateCounter = results.filter(Boolean).length;
            syncSucceeded = true;
            const finalDuration = Date.now() - syncStartTime;

            if (updateCounter > 0) {
                SyncActiveStore.update(s => {
                    s.counter++;
                    s.lastSynced = currentTime;
                    s.lastDuration = finalDuration;
                    s.waitForApproval = false;
                });
                setChanged(true);
                addSyncLog(`Synchronization completed. Applied ${updateCounter} updates.`, "success");
            } else {
                SyncActiveStore.update(s => {
                    s.lastSynced = currentTime;
                    s.lastDuration = finalDuration;
                });
                addSyncLog("Synchronization completed. No changes found.", "info");
            }
        } catch (err) {
            addSyncLog(`Critical sync error: ${err.message}`, "error");
            setError("SYNC_FAILED");
        } finally {
            await flushManifestUpdates();

            startRef.current = 0;
            SyncActiveStore.update(s => {
                s.busy = false;
                s.startTime = 0;
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
        if (!busy || !startTime) return;

        // Initialize duration immediately on mount if already busy
        setDuration(Date.now() - startTime);

        const intervalHandle = setInterval(() => {
            setDuration(Date.now() - startTime);
        }, 100);

        return () => clearInterval(intervalHandle);
    }, [busy, startTime]);

    const percentage = progress.total > 0 ? Math.min(100, Math.round((progress.processed / progress.total) * 100)) : 0;

    return {
        sync: online && syncNow,
        busy,
        error,
        active,
        duration: busy ? (startTime ? Date.now() - startTime : (startRef.current ? Date.now() - startRef.current : 0)) : lastDuration,
        complete,
        changed,
        progress,
        percentage,
        currentBundle,
        lastSynced,
        logs
    };
}
