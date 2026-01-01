import storage from "@util/storage";
import { makePath } from "@util/path";
import { Store } from "pullstate";
import { useCallback, useEffect, useMemo } from "react";
import { registerToolbar, useToolbar } from "@components/Toolbar";
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import { useTranslations } from "@util/translations";
import { useLocalStorage } from "@util/store";
import { useGroups, GroupsStore } from "@util/groups";
import { useSync } from "@sync/sync";
import { FILES_MANIFEST } from "@sync/constants";
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
    groupsHash: "",
    showFilterDialog: false,
    order: "asc",
    orderBy: "date",
    viewMode: "list",
    scrollOffset: 0
});

export function useSessions(depends = [], options = {}) {
    const isMobile = useDeviceType() !== "desktop";
    const { filterSessions = true, skipSync = false, showToolbar } = options;
    const [syncCounter] = useSync({ ...options, active: !skipSync });
    const translations = useTranslations();
    const { settings: groupsSettings } = GroupsStore.useState();
    const [groupMetadata, loading, setGroups] = useGroups([syncCounter, ...depends]);
    const { busy, sessions, groups, groupFilter, typeFilter, yearFilter, syncCounter: savedSyncCounter, groupsHash, showFilterDialog } = SessionsStore.useState();
    useLocalStorage("sessions", SessionsStore, ["groupFilter", "typeFilter", "yearFilter"]);
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

        // Helper to yield to the event loop
        const yieldToEventLoop = () => new Promise(resolve => setTimeout(resolve, 0));

        try {
            const [groupsSyncData, filesManifest] = await Promise.all([
                (async () => {
                    const path = makePath("local/sync/groups.json");
                    if (await storage.exists(path)) {
                        const content = await storage.readFile(path);
                        return JSON.parse(content);
                    }
                    return null;
                })(),
                (async () => {
                    const path = makePath("local/sync", FILES_MANIFEST);
                    if (await storage.exists(path)) {
                        const content = await storage.readFile(path);
                        return JSON.parse(content);
                    }
                    return null;
                })()
            ]);
            const cdn = groupsSettings?.cdn || {};

            // groupsSyncData.groups is now an array of { name, counter }
            const groups = Array.isArray(groupsSyncData?.groups) ? groupsSyncData.groups : [];

            // Process groups in chunks to avoid blocking
            const CHUNK_SIZE = 3;
            let groupsWithYears = [];

            for (let i = 0; i < groups.length; i += CHUNK_SIZE) {
                const chunk = groups.slice(i, i + CHUNK_SIZE);
                const chunkResults = await Promise.all(chunk.map(async group => {
                    const groupName = group.name;
                    if (group.bundled) {
                        const path = makePath("local/sync/bundle.json");
                        if (await storage.exists(path)) {
                            const content = await storage.readFile(path);
                            const data = JSON.parse(content);
                            if (data && Array.isArray(data.sessions)) {
                                const groupSessions = data.sessions.filter(s => s.group === groupName);
                                return { group, sessions: groupSessions };
                            }
                        }
                    }

                    // Check manifest for merged file first
                    const mergedPath = `/${groupName}.json`;
                    // Check if file is in manifest (prefer manifest over fs check for perf) or fallback to fs if manifest missing
                    let isMerged = filesManifest && filesManifest.some(f => f.path === mergedPath);
                    if (!filesManifest) {
                        isMerged = await storage.exists(makePath(`local/sync/${groupName}.json`));
                    }

                    if (isMerged) {
                        const path = makePath(`local/sync/${groupName}.json`);
                        if (await storage.exists(path)) {
                            const content = await storage.readFile(path);
                            const groupData = JSON.parse(content);
                            if (groupData && groupData.sessions) {
                                return { group, sessions: groupData.sessions };
                            }
                        }
                    }

                    // Standard enabled groups: Find year files
                    // If manifest exists, use it to find year files
                    let years = [];
                    if (filesManifest) {
                        // Paths in manifest have leading slash: /groupname/year.json
                        const yearRegex = new RegExp(`^/${groupName}/(\\d+)\\.json$`);
                        years = filesManifest
                            .filter(f => yearRegex.test(f.path))
                            .map(f => ({ name: f.path.match(yearRegex)[1] }));
                    } else {
                        // Fallback to reading summary file (legacy/during transition) or directory listing
                        try {
                            // Try listing first as summary file is deprecated
                            const listing = await storage.getListing(makePath("local/sync", groupName));
                            if (listing) {
                                years = listing.filter(f => f.name.endsWith(".json")).map(f => ({ name: f.name.replace(".json", "") }));
                            }
                        } catch (err) {
                            // ignore missing dir
                        }
                    }

                    return { group, years };
                }));
                groupsWithYears.push(...chunkResults);

                // Yield to UI after each chunk
                if (i + CHUNK_SIZE < groups.length) {
                    await yieldToEventLoop();
                }
            }

            const tasks = groupsWithYears.flatMap(({ group, years, sessions }) => {
                if (sessions) {
                    return [{ group, sessions }];
                }
                return years.map(year => ({ group, year }));
            });

            // Process year files in chunks
            const YEAR_CHUNK_SIZE = 5;
            let allSessions = [];

            for (let i = 0; i < tasks.length; i += YEAR_CHUNK_SIZE) {
                const chunk = tasks.slice(i, i + YEAR_CHUNK_SIZE);
                const chunkResults = await Promise.all(chunk.map(async ({ group, year, sessions }) => {
                    try {
                        let dataSessions = sessions;
                        let path = "";

                        // If we don't have pre-loaded sessions (from merged file), load year file
                        if (!dataSessions) {
                            path = makePath("local/sync", group.name, `${year.name}.json`);
                            if (await storage.exists(path)) {
                                const content = await storage.readFile(path);
                                const data = JSON.parse(content);
                                if (data && data.sessions) {
                                    dataSessions = data.sessions;
                                }
                            }
                        }

                        if (!dataSessions) {
                            return [];
                        }

                        const groupInfo = (groupMetadata || []).find(item => item.name === group.name) || {};

                        return dataSessions.map(session => {
                            let thumbnail = session.thumbnail;
                            if (session.image && cdn.url) {
                                thumbnail = cdn.url + encodeURI(session.image.path.replace("/aws", ""));
                            }

                            return {
                                ...session,
                                color: groupInfo.color,
                                thumbnail
                            };
                        });
                    } catch (err) {
                        console.error("Error reading sessions file", path, err);
                        return [];
                    }
                }));

                allSessions.push(...chunkResults.flat());

                // Yield to UI after each chunk
                if (i + YEAR_CHUNK_SIZE < tasks.length) {
                    await yieldToEventLoop();
                }
            }

            SessionsStore.update(s => {
                s.sessions = allSessions;
                s.groups = groups;
                s.busy = false;
                s.syncCounter = syncCounter;
                s.groupsHash = JSON.stringify({ metadata: groupMetadata, settings: groupsSettings });
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
                s.syncCounter = syncCounter;
            });
        }
    }, [groupsSettings]);

    useEffect(() => {
        if (groupMetadata && groupMetadata.length && !loading) {
            const currentHash = JSON.stringify({ metadata: groupMetadata, settings: groupsSettings });
            const groupsChanged = currentHash !== groupsHash;
            const noSessions = sessions === null;
            const syncChanged = syncCounter !== savedSyncCounter;

            // Update sessions if:
            // 1. We have no sessions yet (initial load)
            // 2. Groups metadata/settings changed (group colors, names, CDN, etc.)
            // 3. Sync counter changed (new session data was synced)
            if (noSessions || groupsChanged || syncChanged) {
                updateSessions(groupMetadata, syncCounter);
            }
        }
    }, [groupMetadata, loading, updateSessions, syncCounter, savedSyncCounter, groupsHash, sessions, groupsSettings]);

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
            const excluded = ["with_thumbnail", "without_thumbnail", "thumbnails_all", "with_summary", "without_summary", "summaries_all", "with_tags", "without_tags", "tags_all"];
            const types = typeFilter.filter(t => !excluded.includes(t));
            const withThumbnail = typeFilter.includes("with_thumbnail");
            const withoutThumbnail = typeFilter.includes("without_thumbnail");
            const withSummary = typeFilter.includes("with_summary");
            const withoutSummary = typeFilter.includes("without_summary");
            const withTags = typeFilter.includes("with_tags");
            const withoutTags = typeFilter.includes("without_tags");

            results = results.filter(session => {
                const matchType = !types.length || types.includes(session.type);

                const hasThumbnail = !!session.thumbnail;
                let matchThumbnail = true;
                if (withThumbnail && withoutThumbnail) {
                    matchThumbnail = true;
                } else if (withThumbnail) {
                    matchThumbnail = hasThumbnail;
                } else if (withoutThumbnail) {
                    matchThumbnail = !hasThumbnail;
                }

                const hasSummary = !!session.summary;
                let matchSummary = true;
                if (withSummary && withoutSummary) {
                    matchSummary = true;
                } else if (withSummary) {
                    matchSummary = hasSummary;
                } else if (withoutSummary) {
                    matchSummary = !hasSummary;
                }

                const hasTags = !!session.tags?.length;
                let matchTags = true;
                if (withTags && withoutTags) {
                    matchTags = true;
                } else if (withTags) {
                    matchTags = hasTags;
                } else if (withoutTags) {
                    matchTags = !hasTags;
                }

                return matchType && matchThumbnail && matchSummary && matchTags;
            });
        }
        if (yearFilter?.length) {
            results = results.filter(session => yearFilter.includes(session.year));
        }
        return results;
    }, [groupFilter, typeFilter, yearFilter, sessions]);

    const items = filterSessions ? filtered : sessions;

    // Only show loading if we don't have sessions yet
    // Don't show loading during sync if we already have data
    const isLoading = (busy || loading) && sessions === null;
    return [items, isLoading, groupMetadata, setGroups];
}
