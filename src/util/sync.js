import { useRef, useEffect, useState, useCallback } from "react";
import { Store } from "pullstate";
import { fetchJSON } from "@/util/fetch";
import { useLocalStorage } from "@/util/store";
import { useInterval } from "@/util/timers";
import storage from "@/util/storage";
import Cookies from 'js-cookie';
import { useOnline } from "./online";

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
            const itemPath = [folder, name].filter(Boolean).join("/");
            Object.assign(item, stat);
            item.id = item.path = endPoint + itemPath;
            item.name = name;
            item.folder = [endPoint, folder].filter(Boolean).join("/");
            item.local = ["local", itemPath].filter(Boolean).join("/");
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
    const { lastUpdated } = SyncStore.useState();
    const { active } = SyncActiveStore.useState();
    useLocalStorage("SyncStore", SyncStore);
    const updateSync = useCallback(async () => {
        if (busyRef.current) {
            return;
        }
        busyRef.current = true;
        setError(null);
        setBusy(true);
        const currentTime = new Date().getTime();
        const isSignedIn = Cookies.get("id") && Cookies.get("hash");
        const remote = (await fetchUpdated("remote", lastUpdated, currentTime)) || [];
        try {
            const personal = (isSignedIn && (await fetchUpdated("personal", lastUpdated, currentTime))) || [];
            const listing = [...remote, ...personal];
            for (const item of listing) {
                await storage.createFolders(item.local);
                if (item.type === "file") {
                    const buffer = await storage.readFile(item.path);
                    if (buffer) {
                        await storage.writeFile(item.local, buffer, "utf8");
                    }
                }
                else if (item.type === "dir") {
                    await storage.createFolder(item.local);
                }
            }
            SyncStore.update(s => {
                s.lastUpdated = currentTime;
                if (listing.length) {
                    s.listing = listing;
                    s.counter++;
                }
            });
        }
        catch (err) {
            console.error(err);
            setError(err);
        }
        busyRef.current = false;
        setBusy(false);
    }, [lastUpdated]);
    useInterval(updateSync, 60000, [lastUpdated]);
    useEffect(() => {
        updateSync();
    }, [online]);
    return [online && updateSync, isBusy, error, active];
}
