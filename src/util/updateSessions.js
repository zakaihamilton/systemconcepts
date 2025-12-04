import { useMemo } from "react";
import storage from "@util/storage";
import { makePath } from "@util/path";
import { Store } from "pullstate";
import { useCallback } from "react";
import pLimit from "./p-limit";

export const UpdateSessionsStore = new Store({
    busy: false,
    status: [],
    start: 0
});

export function useUpdateSessions() {
    const { busy, status, start } = UpdateSessionsStore.useState();
    const prefix = makePath("aws/sessions") + "/";
    const getListing = useCallback(async path => {
        let listing = await storage.getListing(path);
        if (!listing) {
            return [];
        }
        const sharedPath = "shared/sessions/" + path.substring(prefix.length) + "/listing.json";
        const listingBody = JSON.stringify(listing, null, 4);
        const exists = await storage.exists(sharedPath);
        if (exists) {
            const body = await storage.readFile(sharedPath);
            if (body === listingBody) {
                return listing;
            }
        }
        else {
            await storage.createFolderPath(sharedPath);
        }
        await storage.writeFile(sharedPath, listingBody);
        return listing;
    }, []);
    const copyFile = useCallback(async (path, name) => {
        const sourcePath = path + name;
        const targetPath = "shared/sessions/" + path.substring(prefix.length) + name;
        let sourceBody = null;
        try {
            sourceBody = await storage.readFile(sourcePath);
        } catch (err) {
            console.warn(`File not found: ${sourcePath}`);
            return;
        }

        if (!sourceBody) {
            return;
        }

        const exists = await storage.exists(targetPath);
        if (exists) {
            const targetBody = await storage.readFile(targetPath);
            if (targetBody === sourceBody) {
                return;
            }
        }
        else {
            await storage.createFolderPath(targetPath);
        }
        await storage.writeFile(targetPath, sourceBody);
    }, []);
    const updateGroup = useCallback(async (name, updateAll) => {
        const path = prefix + name;
        let itemIndex = 0;
        UpdateSessionsStore.update(s => {
            itemIndex = s.status.findIndex(item => item.name === name);
            const statusItem = {
                name: name,
                years: [],
                errors: []
            };
            if (itemIndex === -1) {
                s.status = [...s.status, statusItem];
                itemIndex = s.status.length - 1;
            }
            else {
                s.status[itemIndex] = statusItem;
                s.status = [...s.status];
            }
        });
        let years = [];
        try {
            years = await getListing(path);
        }
        catch (err) {
            console.error(err);
            UpdateSessionsStore.update(s => {
                s.status[itemIndex].errors.push(err);
                s.status = [...s.status];
            });
        }
        if (!updateAll) {
            const currentYear = new Date().getFullYear();
            years = years.filter(year => {
                const yearName = parseInt(year.name);
                return yearName === currentYear;
            });
        }
        const limit = pLimit(4);
        const promises = years.map((year, yearIndex) => limit(async () => {
            const percentage = parseInt(((yearIndex) / years.length) * 100);
            UpdateSessionsStore.update(s => {
                s.status[itemIndex].years.push(year.name);
                s.status[itemIndex].count = years.length;
                s.status[itemIndex].progress = percentage;
                s.status[itemIndex].index = yearIndex + 1;
                s.status = [...s.status];
            });
            try {
                await getListing(year.path);
                await copyFile(year.path, "/metadata.json");
            }
            catch (err) {
                console.error(err);
                UpdateSessionsStore.update(s => {
                    s.status[itemIndex].errors.push(err);
                    s.status = [...s.status];
                });
            }
        }));
        await Promise.all(promises);
        UpdateSessionsStore.update(s => {
            s.status[itemIndex].index = years.length;
            s.status[itemIndex].progress = 100;
            s.status = [...s.status];
        });
    }, []);
    const updateSessions = useCallback(async () => {
        UpdateSessionsStore.update(s => {
            s.busy = true;
            s.start = new Date().getTime();
        });
        let items = [];
        try {
            items = await getListing(prefix);
        }
        catch (err) {
            console.error(err);
        }
        if (!items) {
            return;
        }
        const limit = pLimit(4);
        const promises = items.map(item => limit(() => updateGroup(item.name)));
        await Promise.all(promises);
        UpdateSessionsStore.update(s => {
            s.busy = false;
        });
    }, []);
    const updateAllSessions = useCallback(async () => {
        UpdateSessionsStore.update(s => {
            s.busy = true;
            s.start = new Date().getTime();
        });
        let items = [];
        try {
            items = await getListing(prefix);
        }
        catch (err) {
            console.error(err);
        }
        if (!items) {
            return;
        }
        const limit = pLimit(4);
        const promises = items.map(item => limit(() => updateGroup(item.name, true)));
        await Promise.all(promises);
        UpdateSessionsStore.update(s => {
            s.busy = false;
        });
    }, []);
    const updateSpecificGroup = useCallback(async (name) => {
        UpdateSessionsStore.update(s => {
            s.busy = true;
            s.start = new Date().getTime();
        });
        await updateGroup(name);
        UpdateSessionsStore.update(s => {
            s.busy = false;
        });
    }, []);
    return useMemo(() => ({
        status,
        busy,
        start,
        updateSessions: !busy && updateSessions,
        updateAllSessions: !busy && updateAllSessions,
        updateGroup: !busy && updateSpecificGroup
    }), [status, busy, start, updateSessions, updateAllSessions, updateSpecificGroup]);
}
