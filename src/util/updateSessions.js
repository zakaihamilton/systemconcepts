import { useMemo } from "react";
import storage from "@util/storage";
import { makePath } from "@util/path";
import { Store } from "pullstate";
import { useCallback } from "react";
import pLimit from "./p-limit";

export const UpdateSessionsStore = new Store({
    busy: false,
    status: [],
    start: 0
});

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
                                } else {
                                    console.warn(`[Tags] ${name} has no 'tags' property:`, json);
                                }
                            } catch (err) {
                                console.error("Failed to parse tags file", name, err);
                            }
                        }
                    }
                }

                if (Object.keys(tagsMap).length > 0) {
                    await storage.writeFile(targetTagsPath, JSON.stringify(tagsMap, null, 4));
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
        UpdateSessionsStore.update(s => {
            s.status[itemIndex].progress = years.length;
            s.status[itemIndex].year = null;
            s.status = [...s.status];
        });
    }, [prefix, copyFile, getListing]);
    const updateSessions = useCallback(async (includeDisabled) => {
        UpdateSessionsStore.update(s => {
            s.busy = true;
            s.start = new Date().getTime();
        });
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
        UpdateSessionsStore.update(s => {
            s.busy = false;
        });
    }, [groups, prefix, getListing, updateGroup]);
    const updateAllSessions = useCallback(async (includeDisabled) => {
        UpdateSessionsStore.update(s => {
            s.busy = true;
            s.start = new Date().getTime();
        });
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
        UpdateSessionsStore.update(s => {
            s.busy = false;
        });
    }, [groups, prefix, getListing, updateGroup]);
    const updateSpecificGroup = useCallback(async (name, updateAll) => {
        UpdateSessionsStore.update(s => {
            s.busy = true;
            s.start = new Date().getTime();
        });
        await updateGroup(name, updateAll);
        UpdateSessionsStore.update(s => {
            s.busy = false;
        });
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
