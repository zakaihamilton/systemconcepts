import { useMemo } from "react";
import storage from "@util/storage";
import { makePath, fileTitle, isAudioFile, isVideoFile, isImageFile, isSubtitleFile, isSummaryFile, isTagsFile } from "@util/path";
import { useCallback } from "react";
import pLimit from "./p-limit";

import { SyncActiveStore, UpdateSessionsStore } from "@sync/syncState";
import { addSyncLog } from "@sync/sync";
import { writeCompressedFile } from "@sync/bundle";
import { LOCAL_SYNC_PATH } from "@sync/constants";

export function useUpdateSessions(groups) {
    const { busy, status, start } = UpdateSessionsStore.useState();
    const prefix = makePath("aws/sessions") + "/";
    const getListing = useCallback(async path => {
        let listing = await storage.getListing(path);
        if (!listing) {
            return [];
        }
        return listing;
    }, []);

    const updateGroup = useCallback(async (name, updateAll, updateTags = false) => {
        const path = prefix + name;
        let itemIndex = 0;
        UpdateSessionsStore.update(s => {
            itemIndex = s.status.findIndex(item => item.name === name);
            const statusItem = {
                name: name,
                years: [],
                year: null,
                addedCount: 0,
                removedCount: 0,
                progress: 0,
                count: 0,
                tagCount: 0,
                errors: [],
                newSessions: []
            };
            if (itemIndex === -1) {
                s.status = [...s.status, statusItem];
                itemIndex = s.status.length - 1;
            }
            else {
                s.status[itemIndex] = statusItem;
                s.status = [...s.status];
            }
        });
        const allSessionNames = new Set();
        let years = [];
        try {
            years = await getListing(path);
        }
        catch (err) {
            console.error(err);
            UpdateSessionsStore.update(s => {
                s.status[itemIndex].errors.push(err.message || String(err));
                s.status = [...s.status];
            });
        }
        if (!updateAll) {
            const currentYear = new Date().getFullYear();
            years = years.filter(year => {
                const yearName = parseInt(year.name);
                return yearName === currentYear;
            });
        }
        const limit = pLimit(4);

        UpdateSessionsStore.update(s => {
            s.status[itemIndex].count = years.length;
            s.status = [...s.status];
        });

        const promises = years.map((year) => limit(async () => {
            UpdateSessionsStore.update(s => {
                s.status[itemIndex].years.push(year.name);
                s.status[itemIndex].year = year.name;
                s.status = [...s.status];
            });

            try {
                const yearItems = await getListing(year.path);

                yearItems.sort((a, b) => a.name.localeCompare(b.name));

                // Read tags from .tags files
                const sessionTagsMap = {};
                // If not forcing update, try to load from cache
                if (!updateTags) {
                    const localYearPath = makePath(LOCAL_SYNC_PATH, name, `${year.name}.json`);
                    try {
                        if (await storage.exists(localYearPath)) {
                            const content = await storage.readFile(localYearPath);
                            const data = JSON.parse(content);
                            if (data && Array.isArray(data.sessions)) {
                                data.sessions.forEach(session => {
                                    if (session && session.tags && session.tags.length) {
                                        sessionTagsMap[session.id] = session.tags;
                                    }
                                });
                            }
                        }
                    } catch (err) {
                        console.warn(`[Sync] Failed to read cache from ${localYearPath}`, err);
                    }
                }

                // Group files by session ID
                const sessionFilesMap = {};
                for (const file of yearItems) {
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
                    if (isTagsFile(file.name)) {
                        id = id.replace(/\.tags$/, "");
                        // Only read tag file if forcing update or tag missing from cache
                        if (updateTags || !sessionTagsMap[id]) {
                            try {
                                const content = await storage.readFile(file.path);
                                const data = JSON.parse(content);
                                if (data && Array.isArray(data.tags)) {
                                    sessionTagsMap[id] = data.tags;
                                }
                            } catch (err) {
                                console.error(`Error reading tags file ${file.path}:`, err);
                            }
                        }
                        continue;
                    }

                    if (!sessionFilesMap[id]) {
                        sessionFilesMap[id] = [];
                    }
                    sessionFilesMap[id].push(file);
                }

                const sortedIds = Object.keys(sessionFilesMap).sort((a, b) => a.localeCompare(b));

                const yearSessions = sortedIds.map(id => {
                    const [, date, sessionName] = id.trim().match(/(\d+-\d+-\d+) (.*)/) || [];
                    if (!date || !sessionName) {
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

                    const ai = sessionName.endsWith(" - AI") || sessionName.startsWith("Overview - ");
                    const key = name + "_" + id;
                    // Use tags from map
                    const rawTags = sessionTagsMap[id] || [];
                    const sessionTags = Array.isArray(rawTags) ? [...new Set(rawTags)] : Object.keys(rawTags);
                    const item = {
                        key,
                        id,
                        name: sessionName,
                        date,
                        year: year.name,
                        group: name,
                        ai,
                        tags: sessionTags
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
                        item.thumbnail = true;
                        item.image = imageFile;
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
                        if (sessionName.endsWith(" - AI")) {
                            item.type = "ai";
                        }
                        else if (sessionName.startsWith("Overview - ")) {
                            item.type = "overview";
                        }
                        item.typeOrder -= 5;
                    }

                    return item;
                }).filter(Boolean);

                const count = await updateYearSync(name, year.name, yearSessions);

                if (count > 0) {
                    yearSessions.forEach(session => allSessionNames.add(session.id));
                    UpdateSessionsStore.update(s => {
                        s.status[itemIndex].addedCount += yearSessions.length;
                        s.status = [...s.status];
                    });
                }
            }
            catch (err) {
                console.error(err);
                UpdateSessionsStore.update(s => {
                    s.status[itemIndex].errors.push(err.message || String(err));
                    s.status = [...s.status];
                });
            } finally {
                UpdateSessionsStore.update(s => {
                    s.status[itemIndex].progress++;
                    s.status = [...s.status];
                });
            }
        }));
        await Promise.all(promises);

        // Finalize sync metadata for the whole group
        await finalizeGroupSync(name);

        // Retrieve the final status for this group to avoid stale index issues
        const finalStatus = (UpdateSessionsStore.getRawState().status || []).find(s => s.name === name) || {};
        const addedCount = finalStatus.addedCount || 0;
        const newSessions = finalStatus.newSessions || [];

        UpdateSessionsStore.update(s => {
            const idx = s.status.findIndex(item => item.name === name);
            if (idx !== -1) {
                s.status[idx].progress = years.length;
                s.status[idx].year = null;
                s.status = [...s.status];
            }
        });

        const sortedSessions = [...allSessionNames].sort();
        const totalCount = sortedSessions.length;

        // Use the last newly added session if available, otherwise fallback to last overall
        let lastSession = "";
        if (newSessions.length > 0) {
            const sortedNew = newSessions.map(s => s.name).sort();
            lastSession = sortedNew[sortedNew.length - 1];
        } else if (totalCount > 0) {
            lastSession = sortedSessions[totalCount - 1];
        }

        const lastSessionMsg = lastSession ? `, last: ${lastSession}` : "";
        const newMsg = addedCount > 0 ? `, ${addedCount} updated` : ", no updates";

        addSyncLog(`[${name}] ✓ Updated (${totalCount} sessions${newMsg}${lastSessionMsg}).`, "success");
    }, [prefix, getListing]);
    const updateSessions = useCallback(async (includeDisabled) => {
        const isSyncBusy = SyncActiveStore.getRawState().busy;
        if (isSyncBusy) {
            console.warn("[Update] Sync is currently busy, skipping manual update to avoid conflicts.");
            return;
        }
        UpdateSessionsStore.update(s => {
            s.busy = true;
            s.start = new Date().getTime();
        });
        try {
            let items = [];
            try {
                items = await getListing(prefix);
            }
            catch (err) {
                console.error(err);
            }
            if (!items) {
                return;
            }
            const limit = pLimit(4);
            const promises = items.filter(item => includeDisabled || !groups.find(group => group.name === item.name)?.disabled).map(item => limit(() => updateGroup(item.name)));
            await Promise.all(promises);
        } finally {
            UpdateSessionsStore.update(s => {
                s.busy = false;
            });
        }
    }, [groups, prefix, getListing, updateGroup]);
    const updateAllSessions = useCallback(async (includeDisabled) => {
        const isSyncBusy = SyncActiveStore.getRawState().busy;
        if (isSyncBusy) {
            console.warn("[Update] Sync is currently busy, skipping manual update to avoid conflicts.");
            return;
        }
        UpdateSessionsStore.update(s => {
            s.busy = true;
            s.start = new Date().getTime();
        });
        try {
            let items = [];
            try {
                items = await getListing(prefix);
            }
            catch (err) {
                console.error(err);
            }
            if (!items) {
                return;
            }
            const limit = pLimit(4);
            const promises = items.filter(item => includeDisabled || !groups.find(group => group.name === item.name)?.disabled).map(item => limit(() => updateGroup(item.name, true)));
            await Promise.all(promises);
        } finally {
            UpdateSessionsStore.update(s => {
                s.busy = false;
            });
        }
    }, [groups, prefix, getListing, updateGroup]);
    const updateSpecificGroup = useCallback(async (name, updateAll, updateTags) => {
        const isSyncBusy = SyncActiveStore.getRawState().busy;
        if (isSyncBusy) {
            console.warn("[Update] Sync is currently busy, skipping manual update to avoid conflicts.");
            return;
        }
        UpdateSessionsStore.update(s => {
            s.busy = true;
            s.start = new Date().getTime();
        });
        try {
            await updateGroup(name, updateAll, updateTags);
        } finally {
            UpdateSessionsStore.update(s => {
                s.busy = false;
            });
        }
    }, [updateGroup]);
    return useMemo(() => ({
        status,
        busy,
        start,
        updateSessions: !busy && updateSessions,
        updateAllSessions: !busy && updateAllSessions,
        updateGroup: !busy && updateSpecificGroup
    }), [status, busy, start, updateSessions, updateAllSessions, updateSpecificGroup]);
}

async function updateYearSync(groupName, year, sessions) {
    const localPath = makePath(LOCAL_SYNC_PATH, groupName, `${year}.json`);
    try {
        let version = 1;

        // Check for existing version
        if (await storage.exists(localPath)) {
            const existingContent = await storage.readFile(localPath);
            try {
                const existingData = JSON.parse(existingContent);
                if (existingData && existingData.version) {
                    version = existingData.version + 1;
                }
            } catch (e) {
                // Ignore parse errors, start fresh
            }
        }

        const data = {
            version,
            group: groupName,
            year: year,
            sessions: sessions.sort((a, b) => a.id.localeCompare(b.id)).map(s => ({ name: s.id, ...s })),
            counter: Date.now()
        };
        // Check if content changed
        if (await storage.exists(localPath)) {
            const existingContent = await storage.readFile(localPath);
            // We need to compare w/o version and counter to see if actual data changed,
            // but since we already incremented version, simple string compare won't work if we want to avoid bumps for no reason.
            // Let's compare "sessions" and "group" and "year".
            try {
                const existingObj = JSON.parse(existingContent);
                const exSessions = JSON.stringify(existingObj.sessions);
                const newSessions = JSON.stringify(data.sessions);
                if (exSessions === newSessions && existingObj.group === data.group) {
                    return 0;
                }
                // If we are here, something changed.
                // We typically use the version we calculated earlier.
            } catch (e) {
                // if parse fails, overwrite
            }
        }
        await writeCompressedFile(localPath, data);
        return data.counter;
    } catch (err) {
        console.error(`[Sync] Error updating year sync ${groupName}/${year}:`, err);
        return 0;
    }
}

async function finalizeGroupSync(groupName) {
    const localGroupPath = makePath(LOCAL_SYNC_PATH, `${groupName}.json`);
    const localYearsPath = makePath(LOCAL_SYNC_PATH, groupName);

    try {
        const yearsListing = await storage.getListing(localYearsPath);
        const years = [];
        if (yearsListing) {
            for (const item of yearsListing) {
                if (item.name.endsWith(".json")) {
                    years.push({
                        name: item.name.replace(".json", ""),
                        counter: 0
                    });
                }
            }
        }

        let version = 1;
        if (await storage.exists(localGroupPath)) {
            const existingContent = await storage.readFile(localGroupPath);
            try {
                const existingData = JSON.parse(existingContent);
                if (existingData && existingData.version) {
                    version = existingData.version + 1;
                }
            } catch (e) { }
        }

        const groupData = {
            version,
            group: groupName,
            date: Date.now(),
            years: years
        };

        await writeCompressedFile(localGroupPath, groupData);
        return true;
    } catch (err) {
        console.error(`[Sync] Error finalizing group ${groupName}:`, err);
        return false;
    }
}
