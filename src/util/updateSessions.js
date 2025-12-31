import { useMemo } from "react";
import storage from "@util/storage";
import { makePath } from "@util/path";
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
        const sharedPath = "local/shared/sessions/" + path.substring(prefix.length) + "/listing.json";
        const listingBody = JSON.stringify(listing, null, 4);
        const exists = await storage.exists(sharedPath);
        if (exists) {
            const body = await storage.readFile(sharedPath);
            if (body === listingBody) {
                return listing;
            }
        }
        else {
            await storage.createFolderPath(sharedPath);
        }
        await storage.writeFile(sharedPath, listingBody);
        return listing;
    }, [prefix]);
    const copyFile = useCallback(async (path, name) => {
        const sourcePath = path + name;
        const targetPath = "local/shared/sessions/" + path.substring(prefix.length) + name;
        let sourceBody = null;
        try {
            sourceBody = await storage.readFile(sourcePath);
        } catch (err) {
            console.warn(`File not found: ${sourcePath}`);
            return;
        }

        if (!sourceBody) {
            return;
        }

        const exists = await storage.exists(targetPath);
        if (exists) {
            const targetBody = await storage.readFile(targetPath);
            if (targetBody === sourceBody) {
                return;
            }
        }
        else {
            await storage.createFolderPath(targetPath);
        }
        await storage.writeFile(targetPath, sourceBody);
    }, [prefix]);
    const updateGroup = useCallback(async (name, updateAll) => {
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
                s.status[itemIndex].errors.push(err);
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
        const promises = years.map((year, yearIndex) => limit(async () => {
            UpdateSessionsStore.update(s => {
                s.status[itemIndex].years.push(year.name);
                s.status[itemIndex].year = year.name;
                s.status[itemIndex].count = years.length;
                s.status[itemIndex].progress++;
                s.status = [...s.status];
            });
            try {
                const yearItems = await getListing(year.path);
                const targetYearPath = "local/shared/sessions/" + year.path.substring(prefix.length);
                const targetTagsPath = targetYearPath + "/tags.json";
                let tagsMap = {};
                let tagsJsonMtime = 0;
                let targetItems = [];

                try {
                    targetItems = await storage.getListing(targetYearPath) || [];
                    const tagsJsonItem = targetItems && targetItems.find(item => item.name === "tags.json");
                    if (tagsJsonItem) {
                        try {
                            const tagsContent = await storage.readFile(targetTagsPath);
                            tagsMap = JSON.parse(tagsContent) || {};
                        } catch (err) {
                            console.error("Failed to read/parse tags.json", err);
                        }
                    }
                } catch (err) {
                    // Ignore errors if file doesn't exist or is invalid
                }

                const tagsFiles = yearItems.filter(item => item.name.endsWith(".tags"));
                const yearPrefix = year.path + "/";



                // Determine which files to read
                const filesToRead = tagsFiles.filter(file => {
                    const fileName = file.name.replace(".tags", "");
                    // Read if we don't have it
                    const shouldRead = !tagsMap[fileName];
                    return shouldRead;
                }).map(file => file.name);

                if (filesToRead.length > 0) {
                    // For each new session, find all associated files
                    const newSessionsData = filesToRead.map(tagsFile => {
                        const sessionName = tagsFile.replace(".tags", "");
                        const sessionFiles = yearItems
                            .filter(item => item.name.startsWith(sessionName))
                            .map(item => item.name);
                        return {
                            name: sessionName,
                            files: sessionFiles
                        };
                    });

                    UpdateSessionsStore.update(s => {
                        s.status[itemIndex].addedCount += filesToRead.length;
                        s.status[itemIndex].newSessions = [...s.status[itemIndex].newSessions, ...newSessionsData];
                        s.status = [...s.status];
                    });
                }

                // Remove deleted tags from map
                const currentTagFileNames = tagsFiles.map(f => f.name.replace(".tags", ""));
                let removedCount = 0;
                Object.keys(tagsMap).forEach(key => {
                    if (!currentTagFileNames.includes(key)) {
                        delete tagsMap[key];
                        removedCount++;
                    }
                });
                if (removedCount > 0) {
                    UpdateSessionsStore.update(s => {
                        s.status[itemIndex].removedCount += removedCount;
                        s.status = [...s.status];
                    });
                }

                if (filesToRead.length > 0) {
                    const results = await storage.readFiles(yearPrefix, filesToRead);

                    // Handle case where readFiles returns null/undefined (e.g., network error, permission issue)
                    if (!results) {
                        console.warn(`[Tags] ${year.path}: storage.readFiles returned null/undefined for ${filesToRead.length} files - skipping tags for this year`);
                    } else {
                        for (const name in results) {
                            const content = results[name];

                            // Skip null or empty content (files that don't exist)
                            if (!content) {
                                continue;
                            }

                            const fileName = name.replace(".tags", "");
                            try {
                                const json = JSON.parse(content);

                                // Handle case where JSON.parse returns null (server returned "null" string)
                                if (!json) {
                                    continue;
                                }

                                if (json.tags) {
                                    tagsMap[fileName] = json.tags;
                                    allSessionNames.add(fileName);
                                } else {
                                    console.warn(`[Tags] ${name} has no 'tags' property:`, json);
                                }
                            } catch (err) {
                                console.error("Failed to parse tags file", name, err);
                            }
                        }
                    }
                }

                // Also collect from existing tags if any
                Object.keys(tagsMap).forEach(name => allSessionNames.add(name));

                if (Object.keys(tagsMap).length > 0) {
                    await storage.writeFile(targetTagsPath, JSON.stringify(tagsMap, null, 4));

                    // Update sync metadata for this year
                    await updateYearSync(name, year.name, tagsMap);

                    UpdateSessionsStore.update(s => {
                        s.status[itemIndex].tagCount += Object.keys(tagsMap).length;
                        s.status = [...s.status];
                    });
                }

                const s3MetadataItem = yearItems.find(i => i.name === "metadata.json");
                if (s3MetadataItem) {
                    const localMetadataItem = targetItems.find(i => i.name === "metadata.json");
                    const s3Mtime = s3MetadataItem.mtime ? new Date(s3MetadataItem.mtime).getTime() : 0;
                    const localMtime = localMetadataItem && localMetadataItem.mtime ? new Date(localMetadataItem.mtime).getTime() : 0;

                    if (!localMetadataItem || s3Mtime > localMtime) {
                        await copyFile(year.path, "/metadata.json");
                    }
                }
            }
            catch (err) {
                console.error(err);
                UpdateSessionsStore.update(s => {
                    s.status[itemIndex].errors.push(err);
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
        const newMsg = addedCount > 0 ? `, ${addedCount} new` : ", no new sessions";

        addSyncLog(`[${name}] ✓ Updated (${totalCount} sessions${newMsg}${lastSessionMsg}).`, "success");
    }, [prefix, copyFile, getListing]);
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
    const updateSpecificGroup = useCallback(async (name, updateAll) => {
        UpdateSessionsStore.update(s => {
            s.busy = true;
            s.start = new Date().getTime();
        });
        try {
            await updateGroup(name, updateAll);
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

async function updateYearSync(groupName, year, tagsMap) {
    const localPath = `${LOCAL_SYNC_PATH}/${groupName}/${year}.json`;
    try {
        const data = {
            version: 1,
            group: groupName,
            year: year,
            sessions: Object.keys(tagsMap).sort().map(name => ({ name })),
            counter: Date.now()
        };
        await writeCompressedFile(localPath, data);
        return data.counter;
    } catch (err) {
        console.error(`[Sync] Error updating year sync ${groupName}/${year}:`, err);
        return 0;
    }
}

async function finalizeGroupSync(groupName) {
    const localGroupPath = `${LOCAL_SYNC_PATH}/${groupName}.json`;
    const localYearsPath = `${LOCAL_SYNC_PATH}/${groupName}`;

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

        const groupData = {
            version: 1,
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
