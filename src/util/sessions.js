import storage from "@/util/storage";
import { makePath, fileTitle, isAudioFile, isVideoFile } from "@/util/path";
import { Store } from "pullstate";
import { useCallback, useEffect } from "react";

export const SessionsStore = new Store({
    busy: false,
    sessions: [],
    start: 0
});

export function useSessions() {
    const { busy, sessions, start } = SessionsStore.useState();
    const updateSessions = useCallback(async () => {
        SessionsStore.update(s => {
            s.busy = true;
            s.sessions = [];
            s.start = new Date().getTime()
        });
        const sessions = [];
        const getListing = async path => {
            const localUrl = "local/" + path + "/listing.json";
            const exists = storage.exists(localUrl);
            let data = null;
            if (exists) {
                data = await storage.readFile(localUrl);
            }
            else {
                data = await storage.readFile(url);
                await storage.createFolders(localUrl);
                await storage.writeFile(localUrl, data);
            }
            data = JSON.parse(data);
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
            s.busy = false;
        });
    }, []);
    useEffect(() => {
        if (!busy && (!sessions || !sessions.length)) {
            updateSessions();
        }
    }, []);
    return [sessions, busy, start, !busy && updateSessions];
}
