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

        const startTime = performance.now();
        console.log('[Sessions] Loading sessions...');

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

            // Cache bundle.json to avoid reading it multiple times for bundled groups
            let bundledSessions = [];
            const bundlePath = makePath("local/sync/bundle.json");
            if (await storage.exists(bundlePath)) {
                try {
                    const content = await storage.readFile(bundlePath);
                    const data = JSON.parse(content);
                    if (data?.sessions) {
                        bundledSessions = data.sessions;
                    }
                } catch (err) {
                    console.error("[Sessions] Error reading bundle.json:", err);
                }
            }

            // Load personal metadata (position/duration) from local personal files
            let personalMetadata = {};
            const personalBasePath = "local/personal/metadata/sessions";
            if (await storage.exists(personalBasePath)) {
                try {
                    const listing = await storage.getRecursiveList(personalBasePath);
                    const metadataFiles = listing.filter(item =>
                        item.type !== "dir" &&
                        item.name?.endsWith(".json") &&
                        !item.name.includes("undefined")
                    );

                    console.log(`[Sessions] Found ${metadataFiles.length} personal metadata files`);

                    // Load each metadata file to get position/duration
                    for (const file of metadataFiles) {
                        try {
                            const content = await storage.readFile(file.path);
                            const data = JSON.parse(content);

                            // Extract group and session name from path
                            // Path formats:
                            // - local/personal/metadata/sessions/<group>/<year>/<session>.json
                            // - local/personal/metadata/sessions/<group>/<session>.json
                            // - local/personal/metadata/sessions/<session>.json (flat, no group)
                            let relativePath = file.path.replace(personalBasePath, "");
                            // Remove leading slashes
                            while (relativePath.startsWith("/")) {
                                relativePath = relativePath.substring(1);
                            }

                            const parts = relativePath.split("/");
                            const sessionName = parts[parts.length - 1].replace(".json", "");

                            // Determine group based on path structure
                            let group = "";
                            if (parts.length >= 2) {
                                // Has subfolders - first part is group
                                group = parts[0];
                            }
                            // If no group subfolder, we can't match to sessions (need group)
                            if (!group) {
                                continue;
                            }

                            const key = `${group}/${sessionName}`;
                            personalMetadata[key] = {
                                position: data.position || 0,
                                duration: data.duration || 0
                            };
                        } catch (err) {
                            // Skip files that can't be read/parsed
                        }
                    }

                    if (Object.keys(personalMetadata).length > 0) {
                        console.log(`[Sessions] Loaded ${Object.keys(personalMetadata).length} personal metadata entries`);
                        // Log first few keys for debugging
                        const keys = Object.keys(personalMetadata).slice(0, 3);
                        console.log(`[Sessions] Sample personal metadata keys:`, keys);
                        // Check if a specific key has position
                        const firstKey = keys[0];
                        if (firstKey) {
                            console.log(`[Sessions] First entry value:`, personalMetadata[firstKey]);
                        }
                    }
                } catch (err) {
                    console.error("[Sessions] Error loading personal metadata:", err);
                }
            }

            const timeAfterManifests = performance.now();
            console.log(`[Sessions] Loaded manifests in ${(timeAfterManifests - startTime).toFixed(1)}ms`);

            // Separate bundled groups from non-bundled
            const bundledGroups = new Set();
            const nonBundledGroups = [];
            for (const group of groups) {
                if (group.bundled) {
                    bundledGroups.add(group.name);
                } else {
                    nonBundledGroups.push(group);
                }
            }

            // Process groups in chunks to avoid blocking
            const CHUNK_SIZE = 3;
            let groupsWithYears = [];

            for (let i = 0; i < nonBundledGroups.length; i += CHUNK_SIZE) {
                const chunk = nonBundledGroups.slice(i, i + CHUNK_SIZE);
                const chunkResults = await Promise.all(chunk.map(async group => {
                    const groupName = group.name;

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
                if (i + CHUNK_SIZE < nonBundledGroups.length) {
                    await yieldToEventLoop();
                }
            }

            const timeAfterGroups = performance.now();
            console.log(`[Sessions] Processed ${groups.length} groups (${bundledGroups.size} bundled) in ${(timeAfterGroups - timeAfterManifests).toFixed(1)}ms`);

            const tasks = groupsWithYears.flatMap(({ group, years, sessions }) => {
                if (sessions) {
                    return [{ group, sessions }];
                }
                return years.map(year => ({ group, year }));
            });

            // Pre-compute groupInfo map to avoid repeated lookups
            const groupInfoMap = new Map();
            if (groupMetadata) {
                for (const info of groupMetadata) {
                    groupInfoMap.set(info.name, info);
                }
            }

            // Enrich bundled sessions once (instead of filtering per group)
            if (bundledSessions.length > 0) {
                for (let i = 0; i < bundledSessions.length; i++) {
                    const session = bundledSessions[i];
                    const groupInfo = groupInfoMap.get(session.group);

                    // Skip if group is not actually bundled
                    if (!bundledGroups.has(session.group)) continue;

                    if (session.image && cdn.url) {
                        session.thumbnail = cdn.url + encodeURI(session.image.path.replace("/aws", ""));
                    }

                    if (groupInfo?.color && !session.color) {
                        session.color = groupInfo.color;
                    }

                    // Merge personal metadata (position/duration)
                    const personalKey = `${session.group}/${session.date} ${session.name}`;
                    const personal = personalMetadata[personalKey];
                    if (personal) {
                        session.position = personal.position;
                        session.duration = personal.duration;
                    }
                    if (personal) {
                        session.position = personal.position;
                        session.duration = personal.duration;
                    }
                }
            }

            // Process year files in chunks
            const YEAR_CHUNK_SIZE = 5;
            // Start with enriched bundled sessions
            let allSessions = bundledSessions.slice();

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

                        const groupInfo = groupInfoMap.get(group.name);
                        const groupColor = groupInfo?.color;

                        // Mutate sessions in-place instead of creating new objects
                        for (let i = 0; i < dataSessions.length; i++) {
                            const session = dataSessions[i];

                            // Update thumbnail if CDN URL exists
                            if (session.image && cdn.url) {
                                session.thumbnail = cdn.url + encodeURI(session.image.path.replace("/aws", ""));
                            }

                            // Add color if available and not already set
                            if (groupColor && !session.color) {
                                session.color = groupColor;
                            }

                            // Merge personal metadata (position/duration)
                            const personalKey = `${session.group}/${session.date} ${session.name}`;
                            const personal = personalMetadata[personalKey];
                            if (personal) {
                                session.position = personal.position;
                                session.duration = personal.duration;
                            }
                        }

                        return dataSessions;
                    } catch (err) {
                        console.error("Error reading sessions file", path, err);
                        return [];
                    }
                }));

                // Use concat to avoid spread operator overhead
                allSessions = allSessions.concat(chunkResults.flat());

                // Yield to UI after each chunk
                if (i + YEAR_CHUNK_SIZE < tasks.length) {
                    await yieldToEventLoop();
                }
            }

            const timeAfterSessions = performance.now();
            console.log(`[Sessions] Loaded ${allSessions.length} sessions in ${(timeAfterSessions - timeAfterGroups).toFixed(1)}ms`);
            console.log(`[Sessions] Total load time: ${(timeAfterSessions - startTime).toFixed(1)}ms`);

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
            // Only reload on sync if we had data before (savedSyncCounter > 0)
            // Ignore the initial 0→1 transition which happens on first page load
            const syncChanged = syncCounter !== savedSyncCounter && savedSyncCounter > 0;

            // Update sessions if:
            // 1. We have no sessions yet (initial load)
            // 2. Groups metadata/settings changed (group colors, names, CDN, etc.)
            // 3. Sync counter changed (new session data was synced)
            if (noSessions || groupsChanged || syncChanged) {
                updateSessions(groupMetadata, syncCounter);
            }
        }
    }, [groupMetadata, loading, syncCounter, savedSyncCounter, groupsHash, sessions]);

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
            const excluded = ["with_thumbnail", "without_thumbnail", "thumbnails_all", "with_summary", "without_summary", "summaries_all", "with_tags", "without_tags", "tags_all", "with_position", "without_position", "position_all"];
            const types = typeFilter.filter(t => !excluded.includes(t));
            const withThumbnail = typeFilter.includes("with_thumbnail");
            const withoutThumbnail = typeFilter.includes("without_thumbnail");
            const withSummary = typeFilter.includes("with_summary");
            const withoutSummary = typeFilter.includes("without_summary");
            const withTags = typeFilter.includes("with_tags");
            const withoutTags = typeFilter.includes("without_tags");
            const withPosition = typeFilter.includes("with_position");
            const withoutPosition = typeFilter.includes("without_position");

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

                const hasPosition = !!session.position;
                let matchPosition = true;
                if (withPosition && withoutPosition) {
                    matchPosition = true;
                } else if (withPosition) {
                    matchPosition = hasPosition;
                } else if (withoutPosition) {
                    matchPosition = !hasPosition;
                }

                return matchType && matchThumbnail && matchSummary && matchTags && matchPosition;

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
