import storage from "@/util/storage";
import { makePath } from "@/util/path";
import { Store } from "pullstate";
import { useCallback } from "react";

export const UpdateSessionsStore = new Store({
    busy: false,
    status: [],
    start: 0
});

export function useUpdateSessions() {
    const { busy, status, start } = UpdateSessionsStore.useState();
    const updateSessions = useCallback(async () => {
        const status = [];
        UpdateSessionsStore.update(s => {
            s.busy = true;
            s.start = new Date().getTime()
        });
        let items = [];
        const prefix = makePath("aws/sessions") + "/";
        const copyFile = async (path, name) => {
            const sourcePath = path + name;
            const targetPath = "shared/sessions/" + path.substring(prefix.length) + name;
            await storage.createFolders(targetPath);
            if (!(await storage.exists(sourcePath))) {
                return;
            }
            const sourceBody = await storage.readFile(sourcePath);
            const exists = await storage.exists(targetPath);
            if (exists) {
                const targetBody = await storage.readFile(targetPath);
                if (targetBody === sourceBody) {
                    return;
                }
            }
            await storage.writeFile(targetPath, sourceBody);
        };
        const getListing = async path => {
            let listing = await storage.getListing(path);
            if (!listing) {
                return [];
            }
            const sharedPath = "shared/sessions/" + path.substring(prefix.length) + "/listing.json";
            await storage.createFolders(sharedPath);
            const listingBody = JSON.stringify(listing, null, 4);
            const exists = await storage.exists(sharedPath);
            if (exists) {
                const body = await storage.readFile(sharedPath);
                if (body === listingBody) {
                    return listing;
                }
            }
            await storage.writeFile(sharedPath, listingBody);
            return listing;
        }
        try {
            items = await getListing(prefix);
        }
        catch (err) {
            console.error(err);
        }
        if (!items) {
            return;
        }
        UpdateSessionsStore.update(s => {
            status.push(...items.map(item => {
                return {
                    name: item.name,
                    years: [],
                    progress: 0,
                    errors: []
                };
            }));
            s.status = [...status];
        });
        for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
            let item = items[itemIndex];
            let years = [];
            try {
                years = await getListing(item.path);
            }
            catch (err) {
                console.error(err);
                UpdateSessionsStore.update(s => {
                    s.status[itemIndex].errors.push(err);
                    s.status = [...s.status];
                });
            }
            for (let yearIndex = 0; yearIndex < years.length; yearIndex++) {
                const year = years[yearIndex];
                UpdateSessionsStore.update(s => {
                    s.status[itemIndex].years.push(year.name);
                    s.status[itemIndex].count = years.length;
                    s.status = [...s.status];
                });
                const percentage = parseInt((yearIndex / years.length) * 100);
                UpdateSessionsStore.update(s => {
                    s.status[itemIndex].progress = percentage;
                    s.status[itemIndex].index = yearIndex;
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
            }
            UpdateSessionsStore.update(s => {
                s.status[itemIndex].index = years.length;
                s.status[itemIndex].progress = 100;
                s.status = [...s.status];
            });
        }
        UpdateSessionsStore.update(s => {
            s.busy = false;
        });
    }, []);
    return [status, busy, start, !busy && updateSessions];
}
