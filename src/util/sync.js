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
    const path = makePath("local", endPoint);
    await storage.createFolderPath(path, true);
    const listing = await storage.getRecursiveList(path);
    const changed = listing.filter(item => item.mtimeMs >= start && item.mtimeMs <= end);
    const remoteFiles = [];
    const files = {};
    const folders = [];
    for (const item of changed) {
        if (item.type === "file") {
            const remote = makePath(item.path.replace(path, ""));
            remoteFiles.push(remote);
        }
    }
    const remoteBuffers = await storage.readFiles("/" + endPoint, remoteFiles);
    if (!remoteBuffers) {
        throw "Cannot read buffers";
    }
    for (const item of changed) {
        if (item.type === "file") {
            let remoteFolder = makePath(item.path.replace(/^\/local\//, ""));
            const remoteFile = makePath(item.path.replace(path, ""));
            const localBuffer = await storage.readFile(item.path);
            if (remoteBuffers[remoteFile] === localBuffer) {
                continue;
            }
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
    await storage.createFolders("/" + endPoint, folders);
    await storage.writeFiles("/" + endPoint, files);
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
        const syncItems = async (device, items) => {
            const files = [];
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
                        files.push({ local, path });
                        await storage.createFolderPath(local);
                    }
                    else if (stat.type === "dir") {
                        await storage.createFolder(local);
                    }
                }
                catch (err) {
                    setError("SYNC_FAILED");
                    console.error(err);
                }
                setDuration(parseInt(duration / 1000) * 1000);
            }
            try {
                const paths = files.map(item => item.path.replace("/" + device, ""));
                const results = await storage.readFiles("/" + device, paths);
                const duration = new Date().getTime() - startRef.current;
                setDuration(parseInt(duration / 1000) * 1000);
                for (const path in results) {
                    const item = files.find(item => item.path === "/" + device + path);
                    if (!item) {
                        continue;
                    }
                    await storage.writeFile(item.local, results[path]);
                }
            }
            catch (err) {
                setError("SYNC_FAILED");
                console.error(err);
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
                const personal = (await fetchUpdated("personal", lastUpdated, currentTime)) || [];
                if (personal.length) {
                    await syncItems("personal", personal);
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
        startRef.current = 0;
        SyncActiveStore.update(s => {
            s.busy = false;
        });
        setComplete(true);
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
