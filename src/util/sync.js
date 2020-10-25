import { useRef, useEffect, useState, useCallback } from "react";
import { Store } from "pullstate";
import { fetchJSON } from "@util/fetch";
import { useLocalStorage } from "@util/store";
import storage from "@util/storage";
import Cookies from 'js-cookie';
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

export function useSync() {
    const { counter, busy } = SyncActiveStore.useState(s => {
        return {
            counter: s.counter,
            busy: s.busy
        };
    });
    useEffect(() => {
        SyncActiveStore.update(s => {
            s.active++;
        });
        return () => {
            SyncActiveStore.update(s => {
                s.active--;
            });
        };
    }, []);
    return [counter, busy];
}

export async function fetchUpdated(endPoint, start, end) {
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
    return listing;
}

export async function syncLocal(endPoint, start, end) {
    const listing = await storage.getRecursiveList("local/" + endPoint);
    const changed = listing.filter(item => item.mtimeMs >= start && item.mtimeMs <= end);
    for (const item of changed) {
        if (item.type === "file") {
            const remote = makePath(item.path.replace(/^\/local\//, ""));
            const localBuffer = await storage.readFile(item.path);
            if (await storage.exists(remote)) {
                const remoteBuffer = await storage.readFile(remote);
                if (remoteBuffer === localBuffer) {
                    continue;
                }
            }
            await storage.createFolders(remote);
            await storage.writeFile(remote, buffer);
        }
    }
}

export function useSyncFeature() {
    const startRef = useRef(null);
    const [duration, setDuration] = useState(0);
    const online = useOnline();
    const [error, setError] = useState(null);
    const { lastUpdated, _loaded } = SyncStore.useState();
    useLocalStorage("sync", SyncStore);
    const visible = usePageVisibility();
    const { active, busy } = SyncActiveStore.useState();
    const isSignedIn = Cookies.get("id") && Cookies.get("hash");
    const updateSync = useCallback(async (pollSync, lastUpdated) => {
        if (startRef.current || !online) {
            return;
        }
        startRef.current = new Date().getTime();
        setDuration(0);
        setError(null);
        const currentTime = new Date().getTime();
        const isSignedIn = Cookies.get("id") && Cookies.get("hash");
        let continueSync = true;
        SyncActiveStore.update(s => {
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
        const syncItems = async items => {
            for (const item of items) {
                const duration = new Date().getTime() - startRef.current;
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
                        continue;
                    }
                    if (stat.type === "file") {
                        const buffer = await storage.readFile(path);
                        await storage.createFolders(local);
                        await storage.writeFile(local, buffer);
                    }
                    else if (stat.type === "dir") {
                        await storage.createFolder(local);
                    }
                }
                catch (err) {
                    console.error(err);
                }
                setDuration(parseInt(duration / 1000) * 1000);
            }
        };
        let updateCounter = false;
        if (isSignedIn) {
            try {
                const shared = (await fetchUpdated("shared", lastUpdated, currentTime)) || [];
                if (shared.length) {
                    await storage.createFolders(makePath("local", "shared"));
                    await syncItems(shared);
                    updateCounter++;
                }
            }
            catch (err) {
                if (err === 401) {
                    setError("ACCESS_DENIED");
                }
                console.error(err);
            }
            try {
                const personal = (await fetchUpdated("personal", lastUpdated, currentTime)) || [];
                if (personal.length) {
                    await storage.createFolders(makePath("local", "personal"));
                    await syncItems(personal);
                    updateCounter++;
                }
                await syncLocal("personal", lastUpdated, currentTime);
            }
            catch (err) {
                console.error(err);
            }
        }
        if (updateCounter) {
            SyncStore.update(s => {
                s.lastUpdated = currentTime;
            });
            SyncActiveStore.update(s => {
                s.counter++;
                s.lastSynced = currentTime;
                s.waitForApproval = false;
            });
        }
        else {
            SyncActiveStore.update(s => {
                s.lastSynced = currentTime;
            });
        }
        startRef.current = 0;
        SyncActiveStore.update(s => {
            s.busy = false;
        });
    }, [online]);
    const fullSync = useCallback(async () => {
        SyncStore.update(s => {
            s.lastUpdated = 0;
        });
        SyncActiveStore.update(s => {
            s.lastSynced = 0;
        });
        updateSync(false, 0);
    }, []);
    const syncNow = useCallback(pollSync => {
        updateSync(pollSync, lastUpdated);
    }, [lastUpdated]);
    useEffect(() => {
        if (online && _loaded && isSignedIn) {
            syncNow(true);
        }
    }, [online, _loaded, isSignedIn, visible]);

    return [online && _loaded && syncNow, online && _loaded && fullSync, busy, error, active, duration];
}
