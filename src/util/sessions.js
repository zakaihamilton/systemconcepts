import storage from "@util/storage";
import { makePath, fileTitle, isAudioFile, isVideoFile } from "@util/path";
import { Store } from "pullstate";
import { useCallback, useEffect, useMemo } from "react";
import { registerToolbar, useToolbar } from "@components/Toolbar";
import GroupWorkIcon from "@mui/icons-material/GroupWork";
import { useTranslations } from "@util/translations";
import { useLocalStorage } from "@util/store";
import { useGroups } from "@util/groups";
import { useSync } from "@util/sync";

registerToolbar("Sessions");

export const SessionsStore = new Store({
    sessions: null,
    groups: [],
    groupFilter: [],
    busy: false,
    counter: 0
});

export function useSessions(depends = [], options = {}) {
    const { filterSessions = true } = options;
    const [syncCounter, syncing] = useSync(options);
    const translations = useTranslations();
    const [groupMetadata, loading] = useGroups([syncCounter, ...depends]);
    const { busy, sessions, groups, groupFilter } = SessionsStore.useState();
    useLocalStorage("sessions", SessionsStore, ["groupFilter"]);
    const updateSessions = useCallback(async groupMetadata => {
        const sessions = [];
        let continueUpdate = true;
        SessionsStore.update(s => {
            if (s.busy) {
                continueUpdate = false;
            }
            else {
                s.busy = true;
            }
        });
        if (!continueUpdate) {
            return;
        }
        const getJSON = async path => {
            const exists = await storage.exists(path);
            let data = [];
            if (exists) {
                data = await storage.readFile(path);
                data = JSON.parse(data);
                if (!data) {
                    data = [];
                }
            }
            return data;
        };
        const getListing = async path => {
            const localUrl = "local/" + path + "/listing.json";
            return await getJSON(localUrl);
        };
        const getMetadata = async path => {
            const localUrl = "local/" + path + "/metadata.json";
            return await getJSON(localUrl);
        };
        const basePath = "shared/sessions";
        const cdn = (await getJSON("local/" + basePath + "/cdn.json")) || {};
        try {
            const groups = await getListing(basePath);
            for (const group of groups) {
                const years = await getListing(makePath(basePath, group.name));
                for (const year of years) {
                    const path = makePath(basePath, group.name, year.name);
                    const files = await getListing(path);
                    const sessionsMetadata = await getMetadata(path);
                    files.sort((a, b) => a.name.localeCompare(b.name));
                    const createItem = ({ key, id, name, date }) => {
                        const groupInfo = (groupMetadata || []).find(item => item.name === group.name) || {};
                        let sessionInfo = (sessionsMetadata || []).find(item => item.name === id) || {};
                        sessionInfo = { ...sessionInfo };
                        delete sessionInfo.name;
                        const item = { key, id, name, date, year: year.name, group: group.name, color: groupInfo.color, ...sessionInfo };
                        sessions.push(item);
                        return item;
                    };
                    for (const file of files) {
                        const id = fileTitle(file.name);
                        const key = group.name + "_" + id;
                        const [, date, name] = id.trim().match(/(\d+-\d+-\d+)\ (.*)/) || [];
                        if (!date || !name) {
                            continue;
                        }
                        if (isAudioFile(file.name)) {
                            let item = sessions.find(session => session.id === id && session.group === group.name);
                            if (!item) {
                                item = createItem({ key, id, name, date, group });
                            }
                            item.audio = file;
                        }
                        else if (isVideoFile(file.name)) {
                            const isResolution = id.match(/(.*)_(\d+x\d+)/);
                            if (isResolution) {
                                const [, id, resolution] = isResolution;
                                const [, date, name] = id.trim().match(/(\d+-\d+-\d+)\ (.*)/) || [];
                                let item = sessions.find(session => session.id === id && session.group === group.name);
                                if (!item) {
                                    item = createItem({ key, id, name, date });
                                }
                                if (!item.resolutions) {
                                    item.resolutions = {};
                                }
                                item.resolutions[resolution] = file;
                            }
                            else {
                                let item = sessions.find(session => session.id === id && session.group === group.name);
                                if (!item) {
                                    item = createItem({ key, id, name, date });
                                }
                                item.video = file;
                                if (cdn.url) {
                                    item.thumbnail = cdn.url + encodeURI(file.path.replace("/aws", "").replace(".mp4", ".png"));
                                }
                            }
                        }
                    }
                }
            }
            SessionsStore.update(s => {
                s.sessions = sessions;
                s.groups = groups;
                s.busy = false;
            });
        }
        catch (err) {
            console.error(err);
        }
        SessionsStore.update(s => {
            s.busy = false;
        });
    }, []);

    useEffect(() => {
        if (groupMetadata && groupMetadata.length && !loading) {
            updateSessions(groupMetadata);
        }
    }, [groupMetadata, loading, updateSessions]);

    const groupsItems = useMemo(() => {
        return groups.map(group => {
            const metadata = (groupMetadata || []).find(item => item.name === group.name) || {};
            return {
                id: group.name,
                icon: !groupFilter.length || groupFilter.includes(group.name) ? <GroupWorkIcon /> : null,
                name: group.name[0].toUpperCase() + group.name.slice(1),
                selected: groupFilter,
                backgroundColor: metadata.color,
                onClick: () => {
                    SessionsStore.update(s => {
                        if (s.groupFilter.includes(group.name)) {
                            s.groupFilter = s.groupFilter.filter(name => name !== group.name);
                        }
                        else {
                            s.groupFilter = [...s.groupFilter, group.name];
                        }
                    });
                }
            };
        });
    }, [groupMetadata, groups, groupFilter]);

    const toolbarItems = [
        {
            id: "group",
            name: translations.GROUPS,
            icon: <GroupWorkIcon />,
            items: groupsItems,
            active: groupFilter.length,
            divider: true,
            disabled: !groupsItems.length
        }
    ].filter(Boolean);

    useToolbar({ id: "Sessions", items: toolbarItems, visible: filterSessions, depends: [translations, groupsItems, groupFilter] });

    const filtered = useMemo(() => {
        if (!groupFilter.length) {
            return sessions;
        }
        return (sessions || []).filter(session => groupFilter.includes(session.group));
    }, [groupFilter, sessions]);

    const items = filterSessions ? filtered : sessions;

    const isLoading = busy || loading || (syncing && (!sessions || !sessions.length));
    const askForFullSync = !isLoading && (!sessions || !sessions.length);

    return [items, isLoading, askForFullSync];
}
