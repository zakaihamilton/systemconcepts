import storage from "@/util/storage";
import { isMediaFile, isImageFile, makePath } from "@/util/path";
import { Store } from "pullstate";
import { shrinkImage } from "@/util/image";
import { readBinary, writeBinary } from "@/util/binary";

export const SessionsStore = new Store({
    busy: false,
    status: [],
    start: 0
});

export function useSessions() {
    const { busy, status, start } = SessionsStore.useState();
    const updateSessions = async () => {
        if (busy) {
            return;
        }
        const status = [];
        SessionsStore.update(s => {
            s.busy = true;
            s.start = new Date().getTime()
        });
        let items = [];
        const prefix = makePath("aws/sessions") + "/";
        try {
            items = await storage.getListing(prefix);
        }
        catch (err) {
            console.error(err);
        }
        if (!items) {
            return;
        }
        SessionsStore.update(s => {
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
                years = await storage.getListing(item.path);
            }
            catch (err) {
                console.error(err);
                SessionsStore.update(s => {
                    s.status[itemIndex].errors.push(err);
                    s.status = [...s.status];
                });
            }
            for (let yearIndex = 0; yearIndex < years.length; yearIndex++) {
                const year = years[yearIndex];
                SessionsStore.update(s => {
                    s.status[itemIndex].years.push(year.name);
                    s.status[itemIndex].count = years.length;
                    s.status = [...s.status];
                });
                const percentage = parseInt((yearIndex / years.length) * 100);
                SessionsStore.update(s => {
                    s.status[itemIndex].progress = percentage;
                    s.status[itemIndex].index = yearIndex;
                    s.status = [...s.status];
                });
                try {
                    const listing = await storage.getListing(year.path);
                    const path = "shared/sessions/" + year.path.substring(prefix.length) + "/listing.json";
                    await storage.createFolders(path);
                    const listingBody = JSON.stringify(listing, null, 4);
                    await storage.writeFile(path, listingBody);
                }
                catch (err) {
                    console.error(err);
                    SessionsStore.update(s => {
                        s.status[itemIndex].errors.push(err);
                        s.status = [...s.status];
                    });
                }
            }
            SessionsStore.update(s => {
                s.status[itemIndex].index = years.length;
                s.status[itemIndex].progress = 100;
                s.status = [...s.status];
            });
        }
        SessionsStore.update(s => {
            s.busy = false;
        });
    };
    return [status, busy, start, updateSessions];
}
