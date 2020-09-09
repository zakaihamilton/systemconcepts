import { useRef } from "react";
import { Store } from "pullstate";
import { fetchJSON } from "@/util/fetch";
import { useLocalStorage } from "@/util/store";
import { useInterval } from "@/util/timers";

export const SyncStore = new Store({
    lastUpdated: 0,
    listing: []
});

export async function fetchUpdated(start, end) {
    const listing = [];
    const items = await fetchJSON("/api/fs", {
        method: "GET",
        headers: {
            query: encodeURIComponent(JSON.stringify({ "stat.mtimeMs": { $gte: start, $lte: end } })),
            fields: encodeURIComponent(JSON.stringify({})),
        }
    });
    for (const item of items) {
        const { name, stat, folder } = item;
        const itemPath = [folder, name].filter(Boolean).join("/");
        Object.assign(item, stat);
        item.id = item.path = "remote" + itemPath;
        item.name = name;
        item.folder = ["remote", folder].filter(Boolean).join("/");
        listing.push(item);
    }
    return listing;
}

export function useSync() {
    const busyRef = useRef(false);
    const { lastUpdated } = SyncStore.useState();
    useLocalStorage("SyncStore", SyncStore);
    useInterval(async () => {
        if (busyRef.current) {
            return;
        }
        busyRef.current = true;
        const currentTime = new Date().getTime();
        const listing = await fetchUpdated(lastUpdated, currentTime);
        SyncStore.update(s => {
            s.lastUpdated = currentTime;
            s.listing = listing || [];
        });
        busyRef.current = false;
    }, 5000, [lastUpdated]);
}
