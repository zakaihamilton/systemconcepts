import { useRef, useEffect, useState, useCallback } from "react";
import { Store } from "pullstate";
import { fetchJSON } from "@/util/fetch";
import { useLocalStorage } from "@/util/store";
import { useInterval } from "@/util/timers";
import storage from "@/util/storage";
import Cookies from 'js-cookie';
import { useOnline } from "@/util/online";
import { makePath } from "@/util/path";
import { usePageVisibility } from "@/util/hooks";

export const SyncStore = new Store({
    lastUpdated: 0
});

export const SyncActiveStore = new Store({
    active: 0,
    counter: 0,
    busy: false
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

export function useSyncFeature() {
    const startRef = useRef(null);
    const [duration, setDuration] = useState(0);
    const online = useOnline();
    const [error, setError] = useState(null);
    const isLoaded = useLocalStorage("SyncStore", SyncStore);
    const visible = usePageVisibility();
    const { lastUpdated } = SyncStore.useState();
    const { active, busy } = SyncActiveStore.useState();
    const isSignedIn = Cookies.get("id") && Cookies.get("hash");
    const resetSync = useCallback(async () => {
        SyncStore.update(s => {
            s.lastUpdated = 0;
        });
    }, []);
    const updateSync = useCallback(async () => {
        if (startRef.current || !online) {
            return;
        }
        startRef.current = new Date().getTime();
        setDuration(0);
        setError(null);
        SyncActiveStore.update(s => {
            s.busy = true;
        });
        const currentTime = new Date().getTime();
        const isSignedIn = Cookies.get("id") && Cookies.get("hash");
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
        try {
            const shared = (await fetchUpdated("shared", lastUpdated, currentTime)) || [];
            if (shared.length) {
                await storage.createFolders(makePath("local", "shared"));
                await syncItems(shared);
                updateCounter++;
            }
        }
        catch (err) {
            console.error(err);
        }
        if (isSignedIn) {
            try {
                const personal = (await fetchUpdated("personal", lastUpdated, currentTime)) || [];
                if (personal.length) {
                    await storage.createFolders(makePath("local", "personal"));
                    await syncItems(personal);
                    updateCounter++;
                }
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
            });
        }
        startRef.current = 0;
        SyncActiveStore.update(s => {
            s.busy = false;
        });
    }, [lastUpdated]);
    useInterval(updateSync, 0, [lastUpdated]);
    useEffect(() => {
        if (online && isLoaded && isSignedIn && visible) {
            updateSync();
        }
    }, [online, isLoaded, isSignedIn, visible]);

    return [online && isLoaded && updateSync, resetSync, busy, error, active, duration];
}
