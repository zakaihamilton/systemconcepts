import storage from "@/util/storage";
import { makePath, fileTitle, isAudioFile, isVideoFile } from "@/util/path";
import { Store } from "pullstate";
import { useCallback, useEffect } from "react";

export const SessionsStore = new Store({
    sessions: []
});

export function useSessions(depends = [], cond = true) {
    const { sessions } = SessionsStore.useState();
    const updateSessions = useCallback(async (fetch) => {
        const sessions = [];
        const getListing = async path => {
            SessionsStore.update(s => {
                s.counter++;
            });
            const localUrl = "local/" + path + "/listing.json";
            const exists = !fetch && storage.exists(localUrl);
            let data = [];
            if (exists) {
                data = await storage.readFile(localUrl);
                data = JSON.parse(data);
            }
            return data;
        }
        try {
            const basePath = "shared/sessions";
            const groups = await getListing(basePath);
            for (const group of groups) {
                const years = await getListing(makePath(basePath, group.name));
                for (const year of years) {
                    const files = await getListing(makePath(basePath, group.name, year.name));
                    files.sort((a, b) => a.name.localeCompare(b.name));
                    for (const file of files) {
                        const id = fileTitle(file.name);
                        const [, date, name] = id.trim().match(/(\d+-\d+-\d+)\ (.*)/) || [];
                        if (isAudioFile(file.name)) {
                            let item = sessions.find(session => session.id === id);
                            if (!item) {
                                item = { id, name, date, year: year.name, group: group.name };
                                sessions.push(item);
                            }
                            item.audio = file;
                        }
                        else if (isVideoFile(file.name)) {
                            const isResolution = id.match(/(.*)_(\d+x\d+)/);
                            if (isResolution) {
                                const [, id, resolution] = isResolution;
                                const [, date, name] = id.trim().match(/(\d+-\d+-\d+)\ (.*)/) || [];
                                let item = sessions.find(session => session.id === id);
                                if (!item) {
                                    item = { id, name, date, year: year.name, group: group.name };
                                    sessions.push(item);
                                }
                                if (!item.resolutions) {
                                    item.resolutions = {};
                                }
                                item.resolutions[resolution] = file;
                            }
                            else {
                                let item = sessions.find(session => session.id === id);
                                if (!item) {
                                    item = { id, name, date, year: year.name, group: group.name };
                                    sessions.push(item);
                                }
                                item.video = file;
                            }
                        }
                    }
                }
            }
        }
        catch (err) {
            console.error(err);
        }
        SessionsStore.update(s => {
            s.sessions = sessions;
        });
    }, []);
    useEffect(() => {
        if (cond) {
            updateSessions();
        }
    }, [depends]);
    return sessions;
}
