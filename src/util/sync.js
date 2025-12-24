import { useRef, useEffect, useState, useCallback } from "react";
import { Store } from "pullstate";
import { fetchJSON } from "@util/fetch";
import { useLocalStorage } from "@util/store";
import storage from "@util/storage";
import Cookies from "js-cookie";
import { useOnline } from "@util/online";
import { makePath } from "@util/path";
import { usePageVisibility } from "@util/hooks";

export const SyncStore = new Store({
    lastUpdated: 0
});

export const SyncActiveStore = new Store({
    active: 0,
    counter: 0,
    busy: false,
    lastSynced: 0
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

export async function fetchUpdated(endPoint, start, end) {
    console.log(`[fetchUpdated] Fetching updated items from ${endPoint} (${new Date(start).toISOString()} to ${new Date(end).toISOString()})`);

    const listing = [];
    const items = await fetchJSON("/api/" + endPoint, {
        method: "GET",
        headers: {
            sync: true,
            query: encodeURIComponent(JSON.stringify({ "stat.mtimeMs": { $gte: start, $lte: end } })),
            fields: encodeURIComponent(JSON.stringify({ folder: 1, name: 1, stat: 1 }))
        }
    });

    if (items) {
        for (const item of items) {
            const { name, stat, folder } = item;
            const itemPath = makePath(folder, name);
            Object.assign(item, stat);
            item.id = item.path = makePath(endPoint, itemPath);
            item.name = name;
            item.local = makePath("local", endPoint, itemPath);
            listing.push(item);
        }
    }

    console.log(`[fetchUpdated] Found ${listing.length} items from ${endPoint}`);
    return listing;
}

export async function syncLocal(endPoint, start, end) {
    // Optimization: Only run syncLocal on full sync (start === 0)
    // Incremental syncs should not check for local changes because:
    // 1. The local filesystem timestamps may change on page refresh
    // 2. This causes false positives where all files appear "modified"
    // 3. Users typically don't modify files locally - they come from the server
    if (start !== 0) {
        console.log(`[syncLocal] Skipping local sync for ${endPoint} (incremental sync - start: ${new Date(start).toISOString()})`);
        return;
    }

    console.log(`[syncLocal] Running full local sync for ${endPoint}`);

    const path = makePath("local", endPoint);
    await storage.createFolderPath(path, true);
    const listing = await storage.getRecursiveList(path);
    const changed = listing.filter(item => item.mtimeMs >= start && item.mtimeMs <= end);

    // Optimization: Skip if no local changes
    if (!changed.length) {
        console.log(`[syncLocal] No local changes for ${endPoint}, skipping sync`);
        return;
    }

    console.log(`[syncLocal] Found ${changed.length} local changes for ${endPoint}`);

    const remoteFiles = [];
    const files = {};
    const folders = [];
    for (const item of changed) {
        if (item.type === "file") {
            const remote = makePath(item.path.replace(path, ""));
            remoteFiles.push(remote);
        }
    }

    // Optimization: Skip readFiles if no files to sync
    if (!remoteFiles.length) {
        console.log(`[syncLocal] No files to sync for ${endPoint}`);
        return;
    }

    console.log(`[syncLocal] Reading ${remoteFiles.length} remote files for comparison`);
    const remoteBuffers = await storage.readFiles("/" + endPoint, remoteFiles);
    if (!remoteBuffers) {
        throw "Cannot read buffers";
    }

    let filesToUpdate = 0;
    for (const item of changed) {
        if (item.type === "file") {
            let remoteFolder = makePath(item.path.replace(/^\/local\//, ""));
            const remoteFile = makePath(item.path.replace(path, ""));
            const localBuffer = await storage.readFile(item.path);
            if (remoteBuffers[remoteFile] === localBuffer) {
                continue;
            }
            filesToUpdate++;
            remoteFolder = makePath(remoteFolder);
            const parts = remoteFolder.split("/").filter(Boolean);
            for (let partIndex = 1; partIndex < parts.length; partIndex++) {
                const subPath = parts.slice(1, partIndex).join("/");
                if (subPath) {
                    folders.push("/" + subPath);
                }
            }
            files[remoteFile] = localBuffer;
        }
    }

    // Optimization: Skip write operations if no files need updating
    if (!filesToUpdate) {
        console.log(`[syncLocal] All files are up to date for ${endPoint}`);
        return;
    }

    console.log(`[syncLocal] Updating ${filesToUpdate} files for ${endPoint}`);
    await storage.createFolders("/" + endPoint, folders);
    await storage.writeFiles("/" + endPoint, files);
    console.log(`[syncLocal] Completed sync for ${endPoint}`);
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
    const { active, busy } = SyncActiveStore.useState();
    const isSignedIn = Cookies.get("id") && Cookies.get("hash");
    const updateSync = useCallback(async (pollSync, lastUpdated) => {
        if (startRef.current || !online) {
            console.log(`[updateSync] Skipping sync - startRef: ${startRef.current}, online: ${online}`);
            return;
        }
        startRef.current = new Date().getTime();
        setComplete(false);
        setDuration(0);
        setError(null);
        setChanged(false);
        const currentTime = new Date().getTime();
        const isSignedIn = Cookies.get("id") && Cookies.get("hash");

        console.log(`[updateSync] Starting sync (pollSync: ${pollSync}, lastUpdated: ${lastUpdated} (${new Date(lastUpdated).toISOString()}), currentTime: ${currentTime} (${new Date(currentTime).toISOString()}))`);

        if (lastUpdated === 0) {
            console.warn(`[updateSync] ⚠️  lastUpdated is 0 - this will fetch ALL files!`);
        } else {
            const timeSinceLastUpdate = ((currentTime - lastUpdated) / 1000 / 60).toFixed(1);
            console.log(`[updateSync] Time since last update: ${timeSinceLastUpdate} minutes`);
        }

        let continueSync = true;
        SyncActiveStore.update(s => {
            const diff = (currentTime - s.lastSynced) / 1000;
            if (pollSync && s.lastSynced && diff < 60) {
                continueSync = false;
                console.log(`[updateSync] Skipping sync - last synced ${diff.toFixed(0)}s ago (< 60s)`);
            }
            else {
                s.busy = true;
            }
        });
        if (!continueSync) {
            startRef.current = 0;
            return;
        }
        const syncItems = async (device, items) => {
            console.log(`[syncItems] Starting sync for ${device} with ${items.length} items`);

            const files = [];
            let dirCount = 0;
            let deleteCount = 0;

            for (const item of items) {
                const duration = new Date().getTime() - startRef.current;
                try {
                    const { deleted, stat, local, path } = item;
                    if (deleted) {
                        deleteCount++;
                        if (await storage.exists(local)) {
                            if (stat.type === "dir") {
                                await storage.deleteFolder(local);
                            }
                            else {
                                await storage.deleteFile(local);
                            }
                        }
                        continue;
                    }
                    if (stat.type === "file") {
                        files.push({ local, path });
                        await storage.createFolderPath(local);
                    }
                    else if (stat.type === "dir") {
                        dirCount++;
                        await storage.createFolderPath(local);
                    }
                }
                catch (err) {
                    setError("SYNC_FAILED");
                    console.error(err);
                }
                setDuration(parseInt(duration / 1000) * 1000);
            }

            console.log(`[syncItems] Processed ${items.length} items for ${device}: ${files.length} files, ${dirCount} directories, ${deleteCount} deletions`);

            if (!files.length) {
                console.log(`[syncItems] No files to fetch for ${device}`);
                return;
            }

            try {
                console.log(`[syncItems] Fetching ${files.length} files from ${device}`);
                const paths = files.map(item => item.path.replace("/" + device, ""));
                const results = await storage.readFiles("/" + device, paths);
                const duration = new Date().getTime() - startRef.current;
                setDuration(parseInt(duration / 1000) * 1000);

                let writtenCount = 0;
                for (const path in results) {
                    const item = files.find(item => item.path === "/" + device + path);
                    if (!item) {
                        continue;
                    }
                    await storage.writeFile(item.local, results[path]);
                    writtenCount++;
                }
                console.log(`[syncItems] Completed sync for ${device}: ${writtenCount} files written`);
            }
            catch (err) {
                setError("SYNC_FAILED");
                console.error(`[syncItems] Error syncing files for ${device}:`, err);
            }
        };
        let updateCounter = 0;
        if (isSignedIn) {
            try {
                const shared = (await fetchUpdated("shared", lastUpdated, currentTime)) || [];
                if (shared.length) {
                    await storage.createFolderPath(makePath("local", "shared"), true);
                    await syncItems("shared", shared);
                    updateCounter++;
                }
                else {
                    console.log(`[updateSync] No updates for shared`);
                }
            }
            catch (err) {
                updateCounter--;
                if (err === 403) {
                    setError("ACCESS_DENIED");
                }
                else {
                    setError("SYNC_FAILED");
                }
                console.error(`[updateSync] Error syncing shared:`, err);
            }
            try {
                const personal = (await fetchUpdated("personal", lastUpdated, currentTime)) || [];
                if (personal.length) {
                    await syncItems("personal", personal);
                    updateCounter++;
                }
                else {
                    console.log(`[updateSync] No updates for personal`);
                }
                await syncLocal("personal", lastUpdated, currentTime);
            }
            catch (err) {
                updateCounter--;
                if (err === 403) {
                    setError("ACCESS_DENIED");
                }
                else {
                    setError("SYNC_FAILED");
                }
                console.error(`[updateSync] Error syncing personal:`, err);
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
            console.log(`[updateSync] Sync completed successfully - ${updateCounter} endpoint(s) updated`);
        }
        else {
            SyncActiveStore.update(s => {
                s.lastSynced = currentTime;
            });
            console.log(`[updateSync] Sync completed - no changes detected`);
        }
        startRef.current = 0;
        SyncActiveStore.update(s => {
            s.busy = false;
        });
        setComplete(true);

        const totalDuration = ((new Date().getTime() - currentTime) / 1000).toFixed(1);
        console.log(`[updateSync] Total sync duration: ${totalDuration}s`);
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

    return {
        sync: online && _loaded && syncNow,
        fullSync: online && _loaded && fullSync,
        busy,
        error,
        active,
        duration,
        complete,
        changed
    };
}
