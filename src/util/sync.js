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
    counter: 0,
    listing: []
});

export const SyncActiveStore = new Store({
    active: 0
});

export function useSync() {
    const { counter, listing } = SyncStore.useState(s => {
        return {
            counter: s.counter,
            listing: s.listing
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
    return [counter, listing];
}

export async function fetchUpdated(endPoint, start, end) {
    const listing = [];
    const items = await fetchJSON("/api/" + endPoint, {
        method: "GET",
        headers: {
            sync: true,
            query: encodeURIComponent(JSON.stringify({ "stat.mtimeMs": { $gte: start, $lte: end } })),
            fields: encodeURIComponent(JSON.stringify({})),
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
    const updateSync = useCallback(async () => {
        if (busyRef.current || !online) {
            return;
        }
        busyRef.current = true;
        setError(null);
        setBusy(true);
        const currentTime = new Date().getTime();
        const isSignedIn = Cookies.get("id") && Cookies.get("hash");
        const listing = [];
        try {
            const shared = (await fetchUpdated("shared", lastUpdated, currentTime)) || [];
            listing.push(...shared);
        }
        catch (err) {
            console.error(err);
        }
        if (isSignedIn) {
            try {
                const personal = (await fetchUpdated("personal", lastUpdated, currentTime)) || [];
                listing.push(...personal);
            }
            catch (err) {
                console.error(err);
            }
        }
        for (const item of listing) {
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
                await storage.createFolders(local);
                if (stat.type === "file") {
                    const buffer = await storage.readFile(path);
                    if (buffer) {
                        await storage.writeFile(local, buffer, "utf8");
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
        SyncStore.update(s => {
            s.lastUpdated = currentTime;
            if (listing.length) {
                s.listing = listing;
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
    return [online && isLoaded && updateSync, isBusy, error, active];
}
