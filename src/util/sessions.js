import storage from "@util/storage";
import { makePath, fileTitle, isAudioFile, isVideoFile, isImageFile, isSubtitleFile, isSummaryFile } from "@util/path";
import { Store } from "pullstate";
import { useCallback, useEffect, useMemo } from "react";
import { registerToolbar, useToolbar } from "@components/Toolbar";
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import { useTranslations } from "@util/translations";
import { useLocalStorage } from "@util/store";
import { useGroups } from "@util/groups";
import { useSync } from "@util/sync";
import GroupWorkIcon from '@mui/icons-material/GroupWork';
import { useDeviceType } from "./styles";

registerToolbar("Sessions");

export const SessionsStore = new Store({
    sessions: null,
    groups: [],
    groupFilter: [],
    typeFilter: [],
    yearFilter: [],
    busy: false,
    counter: 0,
    syncCounter: 0,
    groupsMetadata: "",
    showFilterDialog: false,
    order: "asc",
    orderBy: "date",
    viewMode: "list",
    scrollOffset: 0
});

export function useSessions(depends = [], options = {}) {
    const isMobile = useDeviceType() !== "desktop";
    const { filterSessions = true, skipSync = false, showToolbar } = options;
    const [syncCounter, syncing] = useSync({ ...options, active: !skipSync });
    const translations = useTranslations();
    const [groupMetadata, loading] = useGroups([syncCounter, ...depends]);
    const { busy, sessions, groups, groupFilter, typeFilter, yearFilter, syncCounter: savedSyncCounter, groupsMetadata, showFilterDialog } = SessionsStore.useState();
    useLocalStorage("sessions", SessionsStore, ["groupFilter", "typeFilter", "yearFilter", "showFilterDialog"]);
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
            const normalizedPath = path.startsWith('/') ? path.substring(1) : path;
            const localUrl = "local/" + normalizedPath + "/listing.json";
            return await getJSON(localUrl);
        };
        const getMetadata = async path => {
            const normalizedPath = path.startsWith('/') ? path.substring(1) : path;
            const localUrl = "local/" + normalizedPath + "/metadata.json";
            return await getJSON(localUrl);
        };
        const getTags = async path => {
            // Remove leading slash from path to avoid double slashes (makePath returns /shared/sessions/...)
            const normalizedPath = path.startsWith('/') ? path.substring(1) : path;
            const localUrl = "local/" + normalizedPath + "/tags.json";
            const tags = await getJSON(localUrl);
            return tags;
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
                const [files, sessionsMetadata, tagsMap] = await Promise.all([
                    getListing(path),
                    getMetadata(path),
                    getTags(path)
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
                    if (isSubtitleFile(file.name)) {
                        id = id.replace(/\.[a-z]{2,3}$/, "");
                    }
                    if (!sessionFilesMap[id]) {
                        sessionFilesMap[id] = [];
                    }
                    sessionFilesMap[id].push(file);
                }

                const sortedIds = Object.keys(sessionFilesMap).sort((a, b) => a.localeCompare(b));

                const yearSessions = await Promise.all(sortedIds.map(async id => {
                    const [, date, name] = id.trim().match(/(\d+-\d+-\d+) (.*)/) || [];
                    if (!date || !name) {
                        return null;
                    }

                    const fileList = sessionFilesMap[id];

                    const audioFiles = fileList.filter(f => isAudioFile(f.name));
                    const audioFile = audioFiles.length ? audioFiles[audioFiles.length - 1] : null;

                    const videoFiles = fileList.filter(f => isVideoFile(f.name));

                    const imageFiles = fileList.filter(f => isImageFile(f.name));
                    const imageFile = imageFiles.length ? imageFiles[imageFiles.length - 1] : null;

                    const subtitleFiles = fileList.filter(f => isSubtitleFile(f.name));
                    const subtitleFile = subtitleFiles.length ? subtitleFiles[subtitleFiles.length - 1] : null;

                    const summaryFiles = fileList.filter(f => isSummaryFile(f.name));
                    const summaryFile = summaryFiles.length ? summaryFiles[summaryFiles.length - 1] : null;

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
                    const rawTags = tagsMap[id] || [];
                    const sessionTags = Array.isArray(rawTags) ? [...new Set(rawTags)] : Object.keys(rawTags);
                    const item = {
                        key,
                        id,
                        name,
                        date,
                        year: year.name,
                        group: group.name,
                        color: groupInfo.color,
                        ai,
                        tags: sessionTags,
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

                    if (subtitleFile) {
                        item.subtitles = subtitleFile;
                    }

                    if (summaryFile) {
                        item.summary = { ...summaryFile, path: summaryFile.path.replace(/^\/aws/, "").replace(/^\//, "") };
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
                // Set to empty array instead of leaving undefined
                if (!s.sessions) {
                    s.sessions = [];
                }
                s.busy = false;
            });
        }
    }, []);

    useEffect(() => {
        if (groupMetadata && groupMetadata.length && !loading) {
            const groupsChanged = JSON.stringify(groupMetadata) !== groupsMetadata;
            const noSessions = !sessions || !sessions.length;
            const syncChanged = syncCounter !== savedSyncCounter;

            // Update sessions if:
            // 1. We have no sessions yet (initial load)
            // 2. Groups metadata changed (group colors, names, etc.)
            // 3. Sync counter changed (new session data was synced)
            if (noSessions || groupsChanged || syncChanged) {
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



    const toolbarItems = [
        {
            id: "filter",
            name: translations.FILTER,
            sortKey: 1,
            icon: <FilterAltIcon />,
            location: isMobile ? "mobile" : "header",
            onClick: () => {
                SessionsStore.update(s => {
                    s.showFilterDialog = !s.showFilterDialog;
                });
            },
            active: showFilterDialog
        }
    ].filter(Boolean);

    useToolbar({ id: "Sessions", items: toolbarItems, visible: showToolbar !== undefined ? showToolbar : filterSessions, depends: [translations, groupsItems, showFilterDialog, isMobile] });

    const filtered = useMemo(() => {
        if (!sessions) return [];

        let results = sessions; // No copy needed
        if (groupFilter?.length) {
            results = results.filter(session => groupFilter.includes(session.group));
        }
        if (typeFilter?.length) {
            results = results.filter(session => typeFilter.includes(session.type));
        }
        if (yearFilter?.length) {
            results = results.filter(session => yearFilter.includes(session.year));
        }
        return results;
    }, [groupFilter, typeFilter, yearFilter, sessions]);

    const items = filterSessions ? filtered : sessions;

    // Only show loading if we don't have sessions yet
    // Don't show loading when navigating back if we already have data
    const isLoading = (busy || loading || syncing) && (!sessions || !sessions.length);
    return [items, isLoading];
}
