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

async function runConcurrent(items, concurrency, fn) {
    const queue = [...items];
    const workers = [];
    const runWorker = async () => {
        while (queue.length > 0) {
            const item = queue.shift();
            try {
                await fn(item);
            } catch (err) {
                console.error(err);
            }
        }
    };
    for (let i = 0; i < concurrency; i++) {
        workers.push(runWorker());
    }
    await Promise.all(workers);
}

export async function fetchUpdated(endPoint, start, end) {
    const listing = [];
    let skip = 0;
    const limit = 50; // Fetch in batches of 50 items to strictly stay under 4MB limit
    const maxIterations = 1000; // Safety limit to prevent infinite loops
    let iterations = 0;

    while (iterations < maxIterations) {
        iterations++;

        const items = await fetchJSON("/api/" + endPoint, {
            method: "GET",
            headers: {
                sync: true,
                query: encodeURIComponent(JSON.stringify({
                    "stat.mtimeMs": { $gte: start, $lte: end }
                })),
                fields: encodeURIComponent(JSON.stringify({ folder: 1, name: 1, stat: 1 })),
                skip: skip.toString(),
                limit: limit.toString()
            }
        });

        // Check for errors or invalid responses
        if (!items || !Array.isArray(items) || items.length === 0) {
            break; // No more items to fetch
        }

        for (const item of items) {
            const { name, stat, folder } = item;
            const itemPath = makePath(folder, name);
            Object.assign(item, stat);
            item.id = item.path = makePath(endPoint, itemPath);
            item.name = name;
            item.local = makePath("local", endPoint, itemPath);
            listing.push(item);
        }

        // If we got fewer items than the limit, we've reached the end
        if (items.length < limit) {
            break;
        }

        skip += limit;
    }

    if (iterations >= maxIterations) {
        console.warn(`fetchUpdated hit max iterations (${maxIterations}) for ${endPoint}`);
    }

    return listing;
}

export async function syncLocal(endPoint, start, end) {
    console.log(`syncLocal started for ${endPoint}`);
    const path = makePath("local", endPoint);
    await storage.createFolderPath(path, true);
    const listing = await storage.getRecursiveList(path);
    const changed = listing.filter(item => item.mtimeMs >= start && item.mtimeMs <= end);
    console.log(`syncLocal: Found ${changed.length} changed items locally.`);

    await runConcurrent(changed, 10, async (item) => {
        if (item.type === "file") {
            if (item.size && item.size > 4 * 1024 * 1024) {
                console.warn("Skipping local upload larger than 4MB:", item.path);
                return;
            }
            const remoteFile = makePath(item.path.replace(path, ""));
            const localBuffer = await storage.readFile(item.path);
            let remoteBuffer = null;
            try {
                remoteBuffer = await storage.readFile("/" + endPoint + remoteFile);
            }
            catch (err) {
                console.log("syncLocal: remote file likely does not exist or error reading:", remoteFile);
            }

            if (remoteBuffer === localBuffer) {
                console.log("syncLocal: File unchanged:", remoteFile);
                return;
            }

            console.log("syncLocal: Uploading file:", remoteFile);

            // Ensure remote folders exist
            let remoteFolder = makePath(item.path.replace(/^\/local\//, ""));
            remoteFolder = makePath(remoteFolder);
            const parts = remoteFolder.split("/").filter(Boolean);
            const folders = [];
            for (let partIndex = 1; partIndex < parts.length; partIndex++) {
                const subPath = parts.slice(1, partIndex).join("/");
                if (subPath) {
                    folders.push("/" + subPath);
                }
            }
            if (folders.length) {
                await storage.createFolders("/" + endPoint, folders);
            }

            // Upload file
            await storage.writeFile("/" + endPoint + remoteFile, localBuffer);
        }
    });
    console.log(`syncLocal finished for ${endPoint}`);
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

            const syncItems = async (device, items) => {
                await runConcurrent(items, 10, async (item) => {
                    try {
                        const { deleted, stat, local, path } = item;
                        if (deleted) {
                            if (await storage.exists(local)) {
                                if (stat.type === "dir") {
                                    await storage.deleteFolder(local);
                                }
                                else {
                                    await storage.deleteFile(local);
                                }
                            }
                        }
                        else if (stat.type === "file") {
                            if (stat.size && stat.size > 4 * 1024 * 1024) {
                                console.warn("Skipping file larger than 4MB:", path);
                                return;
                            }
                            await storage.createFolderPath(local);
                            const remotePath = path.replace("/" + device, "");
                            try {
                                const data = await storage.readFile("/" + device + remotePath);
                                if (data) {
                                    await storage.writeFile(local, data);
                                }
                            }
                            catch (err) {
                                console.error("Failed to sync file:", path, err);
                                throw err;
                            }
                        }
                        else if (stat.type === "dir") {
                            await storage.createFolder(local);
                        }
                    }
                    catch (err) {
                        setError("SYNC_FAILED");
                        console.error(err);
                    }
                    SyncActiveStore.update(s => {
                        s.progress.processed++;
                    });
                });
            };
            let updateCounter = 0;
            if (isSignedIn) {
                // First, fetch all items to calculate total count
                let shared = [];
                let personal = [];

                try {
                    console.log("Fetching shared items...");
                    shared = (await fetchUpdated("shared", lastUpdated, currentTime)) || [];
                    console.log("Fetched shared items:", shared.length);
                }
                catch (err) {
                    if (err === 403) {
                        setError("ACCESS_DENIED");
                    }
                    else {
                        setError("SYNC_FAILED");
                    }
                    console.error(err);
                }

                try {
                    console.log("Fetching personal items...");
                    personal = (await fetchUpdated("personal", lastUpdated, currentTime)) || [];
                    console.log("Fetched personal items:", personal.length);
                }
                catch (err) {
                    if (err === 403) {
                        setError("ACCESS_DENIED");
                    }
                    else {
                        setError("SYNC_FAILED");
                    }
                    console.error(err);
                }

                // Set total count before processing
                const totalItems = shared.length + personal.length;
                console.log("Total items to sync:", totalItems);
                SyncActiveStore.update(s => {
                    s.progress = { total: totalItems, processed: 0 };
                });

                // Now process the items
                try {
                    if (shared.length) {
                        console.log("Processing shared items...");
                        await storage.createFolderPath(makePath("local", "shared"), true);
                        await syncItems("shared", shared);
                        console.log("Shared items processed.");
                        updateCounter++;
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
                    console.error(err);
                }
                try {
                    if (personal.length) {
                        console.log("Processing personal items...");
                        await syncItems("personal", personal);
                        console.log("Personal items processed.");
                        updateCounter++;
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
