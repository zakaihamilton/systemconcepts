import storage from "@/util/storage";
import { makePath, fileTitle, isAudioFile, isVideoFile } from "@/util/path";
import { Store } from "pullstate";
import { useCallback, useEffect, useMemo } from "react";
import { registerToolbar, useToolbar } from "@/components/Toolbar";
import GroupWorkIcon from '@material-ui/icons/GroupWork';
import { useTranslations } from "@/util/translations";

registerToolbar("Sessions");

export const SessionsStore = new Store({
    sessions: [],
    groups: [],
    groupFilter: [],
    busy: false,
    counter: 0
});

export function useSessions(depends = [], cond = true, filterSessions = true) {
    const translations = useTranslations();
    const { sessions, groups, groupFilter, busy } = SessionsStore.useState();
    const updateSessions = useCallback(async (fetch) => {
        const sessions = [];
        SessionsStore.update(s => {
            s.busy = true;
        });
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
                if (!data) {
                    data = [];
                }
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
        if (cond && !busy) {
            updateSessions();
        }
    }, [...depends, busy]);

    const groupsItems = useMemo(() => {
        return groups.map(group => {
            return {
                id: group.name,
                icon: !groupFilter.length || groupFilter.includes(group.name) ? <GroupWorkIcon /> : null,
                name: group.name[0].toUpperCase() + group.name.slice(1),
                selected: groupFilter,
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
    }, [groups]);

    const toolbarItems = [
        {
            id: "group",
            name: translations.GROUPS,
            icon: <GroupWorkIcon />,
            items: groupsItems
        }
    ].filter(Boolean);

    useToolbar({ id: "Sessions", items: toolbarItems, visible: filterSessions, depends: [translations, groupsItems] });

    const filtered = useMemo(() => {
        if (!groupFilter.length) {
            return sessions;
        }
        return sessions.filter(session => groupFilter.includes(session.group));
    }, [groupFilter, sessions]);

    if (filterSessions) {
        return filtered;
    }
    else {
        return sessions;
    }
}
