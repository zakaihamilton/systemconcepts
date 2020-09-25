import { useRef, useEffect, useState, useCallback } from "react";
import { Store } from "pullstate";
import { fetchJSON } from "@/util/fetch";
import { useLocalStorage } from "@/util/store";
import { useInterval } from "@/util/timers";
import storage from "@/util/storage";
import Cookies from 'js-cookie';
import { useOnline } from "@/util/online";
import { makePath } from "@/util/path";

export const SyncStore = new Store({
    lastUpdated: 0,
    counter: 0
});

export const SyncActiveStore = new Store({
    active: 0
});

export function useSync() {
    const { counter } = SyncStore.useState(s => {
        return {
            counter: s.counter
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
    return [counter];
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
            item.folder = makePath(endPoint, folder);
            item.local = makePath("local", endPoint, itemPath);
            listing.push(item);
        }
    }
    return listing;
}

export function useSyncFeature() {
    const busyRef = useRef(null);
    const online = useOnline();
    const [isBusy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const isLoaded = useLocalStorage("SyncStore", SyncStore);
    const { lastUpdated } = SyncStore.useState();
    const { active } = SyncActiveStore.useState();
    const resetSync = useCallback(async () => {
        SyncStore.update(s => {
            s.lastUpdated = 0;
        });
    }, []);
    const updateSync = useCallback(async () => {
        if (busyRef.current || !online) {
            return;
        }
        busyRef.current = true;
        setError(null);
        setBusy(true);
        const currentTime = new Date().getTime();
        const isSignedIn = Cookies.get("id") && Cookies.get("hash");
        const syncItems = async items => {
            for (const item of items) {
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
                        if (buffer) {
                            await storage.createFolders(local);
                            await storage.writeFile(local, buffer);
                        }
                    }
                    else if (stat.type === "dir") {
                        await storage.createFolder(local);
                    }
                }
                catch (err) {
                    console.error(err);
                }
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
        SyncStore.update(s => {
            s.lastUpdated = currentTime;
            if (updateCounter) {
                s.counter++;
            }
        });
        busyRef.current = false;
        setBusy(false);
    }, [lastUpdated]);
    useInterval(updateSync, 0, [lastUpdated]);
    useEffect(() => {
        if (online && isLoaded) {
            updateSync();
        }
    }, [online, isLoaded]);
    return [online && isLoaded && updateSync, resetSync, isBusy, error, active];
}
