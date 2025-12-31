import storage from "@util/storage";
import { readCompressedFile } from "@sync/bundle";
import { makePath } from "@util/path";
import { Store } from "pullstate";
import { useCallback, useEffect, useMemo } from "react";
import { registerToolbar, useToolbar } from "@components/Toolbar";
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import { useTranslations } from "@util/translations";
import { useLocalStorage } from "@util/store";
import { useGroups, GroupsStore } from "@util/groups";
import { useSync } from "@sync/sync";
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
            const [groupsSyncData] = await Promise.all([
                readCompressedFile(makePath("local/sync/groups.json"))
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
                    const groupSyncData = await readCompressedFile(makePath("local/sync", `${group.name}.json`));
                    const years = Array.isArray(groupSyncData?.years) ? groupSyncData.years : [];
                    return { group, years };
                }));
                groupsWithYears.push(...chunkResults);

                // Yield to UI after each chunk
                if (i + CHUNK_SIZE < groups.length) {
                    await yieldToEventLoop();
                }
            }

            const tasks = groupsWithYears.flatMap(({ group, years }) =>
                years.map(year => ({ group, year }))
            );

            // Process year files in chunks
            const YEAR_CHUNK_SIZE = 5;
            let allSessions = [];

            for (let i = 0; i < tasks.length; i += YEAR_CHUNK_SIZE) {
                const chunk = tasks.slice(i, i + YEAR_CHUNK_SIZE);
                const chunkResults = await Promise.all(chunk.map(async ({ group, year }) => {
                    const path = makePath("local/sync", group.name, `${year.name}.json`);
                    try {
                        const data = await readCompressedFile(path);
                        if (!data || !data.sessions) {
                            return [];
                        }

                        const groupInfo = (groupMetadata || []).find(item => item.name === group.name) || {};

                        return data.sessions.map(session => {
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
