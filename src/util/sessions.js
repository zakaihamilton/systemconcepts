import storage from "@/util/storage";
import { isMediaFile, isImageFile, makePath } from "@/util/path";
import { Store } from "pullstate";

export const SessionsStore = new Store({
    busy: false,
    status: []
});

export function useStatus() {
    const { busy, status } = SessionsStore.useState();
    const updateSessions = async () => {
        if (busy) {
            return;
        }
        const status = [];
        SessionsStore.update(s => {
            s.busy = true;
        });
        let items = [];
        const prefix = makePath("aws/sessions") + "/";
        try {
            items = await storage.getListing(prefix);
        }
        catch (err) {
            console.error(err);
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
            for (const year of years) {
                SessionsStore.update(s => {
                    s.status[itemIndex].years.push(year.name);
                    s.status = [...s.status];
                });
                let from_sessions = [];
                let to_sessions = [];
                try {
                    SessionsStore.update(s => {
                        s.status[itemIndex].progress = -1;
                        s.status = [...s.status];
                    });
                    from_sessions = await storage.getListing(year.path);
                    const to_path = "shared/sessions/" + year.path.substring(prefix.length);
                    to_sessions = await storage.getListing(to_path);
                    await storage.createFolders(to_path);
                    await storage.createFolder(to_path);
                }
                catch (err) {
                    console.error(err);
                    SessionsStore.update(s => {
                        s.status[itemIndex].errors.push(err);
                        s.status = [...s.status];
                    });
                }
                if (!to_sessions || !from_sessions) {
                    continue;
                }
                for (let sessionIndex = 0; sessionIndex < from_sessions.length; sessionIndex++) {
                    const session = from_sessions[sessionIndex];
                    const path = "shared/sessions/" + session.path.substring(prefix.length);
                    const percentage = parseInt((sessionIndex / from_sessions.length) * 100);
                    SessionsStore.update(s => {
                        s.status[itemIndex].progress = percentage;
                        s.status = [...s.status];
                    });
                    const match = to_sessions.find(item => item.name === session.name);
                    if (match) {
                        continue;
                    }
                    try {
                        if (isImageFile(path)) {
                            await storage.copyFile(session.path, path);
                        }
                        if (isMediaFile(path)) {
                            await storage.writeFile(path, "");
                        }
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
                    s.status[itemIndex].progress = 100;
                    s.status = [...s.status];
                });
            }
        }
        SessionsStore.update(s => {
            s.busy = false;
        });
    };
    return [status, busy, updateSessions];
}
