import storage from "@util/storage";
import { makePath, fileTitle, isAudioFile, isVideoFile, isImageFile } from "@util/path";
import { Store } from "pullstate";
import { useCallback, useEffect, useMemo } from "react";
import { registerToolbar, useToolbar } from "@components/Toolbar";
import GroupWorkIcon from "@mui/icons-material/GroupWork";
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import { useTranslations } from "@util/translations";
import { useLocalStorage } from "@util/store";
import { useGroups } from "@util/groups";
import { useSync } from "@util/sync";
import MovieIcon from "@mui/icons-material/Movie";
import AudioIcon from "@icons/Audio";
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import InsertPhotoOutlinedIcon from '@mui/icons-material/InsertPhotoOutlined';
import MovieFilterIcon from '@mui/icons-material/MovieFilter';

registerToolbar("Sessions");

export const SessionsStore = new Store({
    sessions: null,
    groups: [],
    groupFilter: [],
    typeFilter: [],
    busy: false,
    counter: 0,
    syncCounter: 0,
    groupsMetadata: ""
});

export function useSessions(depends = [], options = {}) {
    const { filterSessions = true } = options;
    const [syncCounter, syncing] = useSync(options);
    const translations = useTranslations();
    const [groupMetadata, loading] = useGroups([syncCounter, ...depends]);
    const { busy, sessions, groups, groupFilter, typeFilter, syncCounter: savedSyncCounter, groupsMetadata } = SessionsStore.useState();
    useLocalStorage("sessions", SessionsStore, ["groupFilter"]);
    const updateSessions = useCallback(async (groupMetadata, syncCounter) => {
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
                try {
                    if (data) {
                        data = JSON.parse(data);
                    }
                }
                catch (err) {
                    console.error("failed to parse", path, err, "data", data);
                }
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
        try {
            const [cdnData, groups] = await Promise.all([
                getJSON("local/" + basePath + "/cdn.json"),
                getListing(basePath)
            ]);
            const cdn = cdnData || {};
            const groupsWithYears = await Promise.all(groups.map(async group => {
                const years = await getListing(makePath(basePath, group.name));
                return { group, years };
            }));

            const tasks = groupsWithYears.flatMap(({ group, years }) =>
                years.map(year => ({ group, year }))
            );

            const processedYears = await Promise.all(tasks.map(async ({ group, year }) => {
                const path = makePath(basePath, group.name, year.name);
                const [files, sessionsMetadata] = await Promise.all([
                    getListing(path),
                    getMetadata(path)
                ]);

                files.sort((a, b) => a.name.localeCompare(b.name));

                // Group files by session ID
                const sessionFilesMap = {};
                for (const file of files) {
                    let id = fileTitle(file.name);
                    // Handle resolution suffix for video files
                    if (isVideoFile(file.name)) {
                        const resolutionMatch = id.match(/(.*)_(\d+x\d+)/);
                        if (resolutionMatch) {
                            id = resolutionMatch[1];
                        }
                    }
                    if (!sessionFilesMap[id]) {
                        sessionFilesMap[id] = [];
                    }
                    sessionFilesMap[id].push(file);
                }

                const sortedIds = Object.keys(sessionFilesMap).sort((a, b) => a.localeCompare(b));

                const yearSessions = await Promise.all(sortedIds.map(async id => {
                    const [, date, name] = id.trim().match(/(\d+-\d+-\d+)\ (.*)/) || [];
                    if (!date || !name) {
                        return null;
                    }

                    const fileList = sessionFilesMap[id];

                    const audioFiles = fileList.filter(f => isAudioFile(f.name));
                    const audioFile = audioFiles.length ? audioFiles[audioFiles.length - 1] : null;

                    const videoFiles = fileList.filter(f => isVideoFile(f.name));

                    const imageFiles = fileList.filter(f => isImageFile(f.name));
                    const imageFile = imageFiles.length ? imageFiles[imageFiles.length - 1] : null;

                    if (!audioFile && !videoFiles.length && !imageFile) {
                        return null;
                    }

                    const groupInfo = (groupMetadata || []).find(item => item.name === group.name) || {};
                    let sessionInfo = (sessionsMetadata || []).find(item => item.name === id) || {};
                    const metadataPath = "local/personal/metadata/sessions/" + group.name + "/" + year.name + "/" + date + " " + name + ".json";
                    const sessionMetadata = await getJSON(metadataPath);

                    sessionInfo = { ...sessionInfo, ...sessionMetadata };
                    delete sessionInfo.name;

                    const ai = name.endsWith(" - AI") || name.startsWith("Overview - ");
                    const key = group.name + "_" + id;
                    const item = {
                        key,
                        id,
                        name,
                        date,
                        year: year.name,
                        group: group.name,
                        color: groupInfo.color,
                        ai,
                        ...sessionInfo,
                        ...sessionMetadata
                    };

                    if (audioFile) {
                        item.audio = audioFile;
                    }

                    if (videoFiles.length) {
                        for (const file of videoFiles) {
                            const fileId = fileTitle(file.name);
                            const resolutionMatch = fileId.match(/(.*)_(\d+x\d+)/);
                            if (resolutionMatch) {
                                const [, , resolution] = resolutionMatch;
                                if (!item.resolutions) {
                                    item.resolutions = {};
                                }
                                item.resolutions[resolution] = file;
                            } else {
                                item.video = file;
                            }
                        }
                    }

                    if (imageFile) {
                        if (cdn.url) {
                            item.thumbnail = cdn.url + encodeURI(imageFile.path.replace("/aws", ""));
                        } else {
                            item.thumbnail = true;
                        }
                    }

                    if (videoFiles.length) {
                        item.type = "video";
                        item.typeOrder = 10;
                    } else if (audioFile) {
                        item.type = "audio";
                        item.typeOrder = 20;
                    } else if (imageFile) {
                        item.type = "image";
                        item.duration = 0.1;
                        item.typeOrder = 30;
                    } else {
                        item.type = "unknown";
                        item.typeOrder = 40;
                    }

                    if (!item.duration) {
                        item.duration = 0.5;
                    }

                    if (ai) {
                        if (name.endsWith(" - AI")) {
                            item.type = "ai";
                        }
                        else if (name.startsWith("Overview - ")) {
                            item.type = "overview";
                        }
                        item.typeOrder -= 5;
                    }

                    return item;
                }));

                return yearSessions.filter(Boolean);
            }));

            const allSessions = processedYears.flat();

            SessionsStore.update(s => {
                s.sessions = allSessions;
                s.groups = groups;
                s.busy = false;
                s.syncCounter = syncCounter;
                s.groupsMetadata = JSON.stringify(groupMetadata);
            });
        }
        catch (err) {
            console.error(err);
            SessionsStore.update(s => {
                s.busy = false;
            });
        }
    }, []);

    useEffect(() => {
        if (groupMetadata && groupMetadata.length && !loading) {
            const groupsChanged = JSON.stringify(groupMetadata) !== groupsMetadata;
            const syncChanged = syncCounter !== savedSyncCounter;
            const noSessions = !sessions || !sessions.length;

            if (noSessions || syncChanged || groupsChanged) {
                updateSessions(groupMetadata, syncCounter);
            }
        }
    }, [groupMetadata, loading, updateSessions, syncCounter, savedSyncCounter, groupsMetadata, sessions]);

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

    const filterItems = useMemo(() => {
        const filter = typeof typeFilter === "string" ? [typeFilter] : (typeFilter || []);
        const onClick = (id) => {
            SessionsStore.update(s => {
                if (filter.includes(id)) {
                    s.typeFilter = filter.filter(name => name !== id);
                }
                else {
                    s.typeFilter = [...filter, id];
                }
            });
        };
        return [
            {
                id: "audio",
                name: translations.AUDIO,
                onClick: onClick.bind(this, "audio"),
                selected: typeFilter,
                icon: <AudioIcon />
            },
            {
                id: "video",
                name: translations.VIDEO,
                onClick: onClick.bind(this, "video"),
                selected: typeFilter,
                icon: <MovieIcon />
            },
            {
                id: "image",
                name: translations.IMAGE,
                onClick: onClick.bind(this, "image"),
                selected: typeFilter,
                icon: <InsertPhotoOutlinedIcon />
            },
            {
                id: "overview",
                name: translations.OVERVIEW,
                onClick: onClick.bind(this, "overview"),
                selected: typeFilter,
                icon: <MovieFilterIcon />
            },
            {
                id: "ai",
                name: translations.AI,
                onClick: onClick.bind(this, "ai"),
                selected: typeFilter,
                icon: <AutoAwesomeIcon />
            }
        ];
    }, [typeFilter, translations]);

    const toolbarItems = [
        {
            id: "group",
            name: translations.GROUPS,
            icon: <GroupWorkIcon />,
            items: groupsItems,
            active: groupFilter.length,
            disabled: !groupsItems.length
        },
        {
            id: "filter",
            name: translations.FILTER,
            icon: <FilterAltIcon />,
            items: filterItems,
            active: typeFilter?.length,
            disabled: !filterItems.length,
            divider: true,
        }
    ].filter(Boolean);

    useToolbar({ id: "Sessions", items: toolbarItems, visible: filterSessions, depends: [translations, groupsItems, groupFilter, typeFilter, filterItems] });

    const filtered = useMemo(() => {
        let results = [...sessions || []];
        if (groupFilter?.length) {
            results = results.filter(session => groupFilter.includes(session.group));
        }
        if (typeFilter?.length) {
            results = results.filter(session => typeFilter.includes(session.type));
        }
        return results;
    }, [groupFilter, typeFilter, sessions]);

    const items = filterSessions ? filtered : sessions;

    const isLoading = busy || loading || (syncing && (!sessions || !sessions.length));
    const askForFullSync = !isLoading && (!sessions || !sessions.length);

    return [items, isLoading, askForFullSync];
}
