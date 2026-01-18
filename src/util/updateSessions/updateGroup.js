import storage from "@util/storage";
import { makePath, fileTitle, isVideoFile, isSubtitleFile, isTagsFile, isDurationFile } from "@util/path";
import pLimit from "../p-limit";
import { UpdateSessionsStore } from "@sync/syncState";
import { addSyncLog } from "@sync/sync";
import { writeCompressedFile } from "@sync/bundle";
import { LOCAL_SYNC_PATH, SYNC_BASE_PATH } from "@sync/constants";
import { getListing, updateYearSync } from "./utils";
import { loadTags, loadDurations } from "./metadata";
import { createSessionItem } from "./mapper";
import { cleanupBundledGroup, cleanupMergedGroup } from "./cleanup";

const prefix = makePath("aws/sessions") + "/";

export async function updateGroupProcess(name, updateAll, forceUpdate = false, isMerged = false, isBundled = false) {
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
    const allSessions = [];
    let existingSessions = [];

    // If merged/bundled and incremental update, load existing sessions first to preserve history
    if ((isMerged || isBundled) && !updateAll) {
        if (isBundled) {
            const bundlePath = makePath(LOCAL_SYNC_PATH, "bundle.json");
            try {
                if (await storage.exists(bundlePath)) {
                    const content = await storage.readFile(bundlePath);
                    const data = JSON.parse(content);
                    if (data && Array.isArray(data.sessions)) {
                        existingSessions = data.sessions.filter(s => s.group === name);
                    }
                }
            } catch (err) {
                console.warn(`[Sync] Failed to read existing bundle file ${bundlePath}`, err);
            }
        } else {
            const localGroupPath = makePath(LOCAL_SYNC_PATH, `${name}.json`);
            try {
                if (await storage.exists(localGroupPath)) {
                    const content = await storage.readFile(localGroupPath);
                    const data = JSON.parse(content);
                    if (data && Array.isArray(data.sessions)) {
                        existingSessions = data.sessions;
                    }
                }
            } catch (err) {
                console.warn(`[Sync] Failed to read existing group file ${localGroupPath}`, err);
            }
        }
        if (existingSessions.length > 0) {
            allSessions.push(...existingSessions);
        }
    }

    let years = [];
    try {
        const fullListing = await getListing(path);
        years = fullListing.filter(year => !year.name.endsWith(".tags") && !year.name.endsWith(".duration"));
    }
    catch (err) {
        console.error(err);
        UpdateSessionsStore.update(s => {
            s.status[itemIndex].errors.push(err.message || String(err));
            s.status = [...s.status];
        });
        // Abort the process to prevent data corruption (writing empty files)
        return;
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

            // Load Metadata
            const sessionTagsMap = await loadTags(year, name, path, forceUpdate, isMerged, isBundled);
            const sessionDurationMap = await loadDurations(year, name, path, forceUpdate, isMerged, isBundled);

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
                if (isTagsFile(file.name) || isDurationFile(file.name)) {
                    continue;
                }

                if (!sessionFilesMap[id]) {
                    sessionFilesMap[id] = [];
                }
                sessionFilesMap[id].push(file);
            }

            const sortedIds = Object.keys(sessionFilesMap).sort((a, b) => a.localeCompare(b));

            const yearSessions = sortedIds.map(id => {
                return createSessionItem(
                    id,
                    sessionFilesMap[id],
                    year.name,
                    name,
                    sessionTagsMap[id] || [],
                    sessionDurationMap[id]
                );
            }).filter(Boolean);

            if (isMerged || isBundled) {
                allSessions.push(...yearSessions);
            } else {
                const { counter, newCount } = await updateYearSync(name, year.name, yearSessions);
                // Track sessions for total count regardless of whether file was updated
                yearSessions.forEach(session => allSessionNames.add(session.id));

                if (counter > 0) {
                    UpdateSessionsStore.update(s => {
                        s.status[itemIndex].addedCount += newCount;
                        s.status = [...s.status];
                    });
                }
            }
        }
        catch (err) {
            console.error(err);
            UpdateSessionsStore.update(s => {
                s.status[itemIndex].errors.push(err.message || String(err));
                s.status = [...s.status];
            });
            throw err; // Abort this year's processing and fail the group update
        } finally {
            UpdateSessionsStore.update(s => {
                s.status[itemIndex].progress++;
                s.status = [...s.status];
            });
        }
    }));
    try {
        await Promise.all(promises);
    } catch (err) {
        console.error(`[Sync] Group ${name} failed to process all years. Aborting write to prevent corruption.`);
        return;
    }

    if (isBundled) {
        // For bundled groups:
        // 1. Deduplicate sessions (preferring fresh ones from this sync)
        const sessionMap = new Map();
        allSessions.forEach(s => sessionMap.set(s.id, s));
        const uniqueSessions = Array.from(sessionMap.values());
        uniqueSessions.sort((a, b) => a.id.localeCompare(b.id));

        if (existingSessions) {
            existingSessions.sort((a, b) => a.id.localeCompare(b.id));
            const uniqueSessionsStr = JSON.stringify(uniqueSessions);
            const existingSessionsStr = JSON.stringify(existingSessions);

            if (uniqueSessionsStr === existingSessionsStr && !forceUpdate) {
                addSyncLog(`[${name}] ✓ Verified (no changes).`, "success");
                return uniqueSessions;
            }
        }

        // 2. Cleanup
        await cleanupBundledGroup(name);

        const existingIds = new Set(existingSessions.map(s => s.id));
        const addedCount = uniqueSessions.filter(s => !existingIds.has(s.id)).length;

        UpdateSessionsStore.update(s => {
            s.status[itemIndex].addedCount = addedCount;
            s.status = [...s.status];
        });
        uniqueSessions.forEach(session => allSessionNames.add(session.id));

        return uniqueSessions;
    }

    if (isMerged) {
        // For merged groups:
        // 1. Deduplicate sessions (preferring fresh ones from this sync)
        const sessionMap = new Map();
        allSessions.forEach(s => sessionMap.set(s.id, s));
        const uniqueSessions = Array.from(sessionMap.values());
        uniqueSessions.sort((a, b) => a.id.localeCompare(b.id));

        let hasChanges = true;
        if (existingSessions) {
            existingSessions.sort((a, b) => a.id.localeCompare(b.id));
            const uniqueSessionsStr = JSON.stringify(uniqueSessions);
            const existingSessionsStr = JSON.stringify(existingSessions);

            if (uniqueSessionsStr === existingSessionsStr && !forceUpdate) {
                hasChanges = false;
                addSyncLog(`[${name}] ✓ Verified (no changes).`, "success");
                return;
            }
        }

        if (hasChanges) {
            // 2. Write ONE merged file
            const localGroupPath = makePath(LOCAL_SYNC_PATH, `${name}.json`);
            const groupData = {
                version: 1,
                group: name,
                date: Date.now(),
                sessions: uniqueSessions
            };
            await writeCompressedFile(localGroupPath, groupData);

            // 3. Cleanup
            await cleanupMergedGroup(name);
        }

        const existingIds = new Set(existingSessions.map(s => s.id));
        const addedCount = uniqueSessions.filter(s => !existingIds.has(s.id)).length;

        UpdateSessionsStore.update(s => {
            s.status[itemIndex].addedCount = addedCount;
            s.status = [...s.status];
        });
        uniqueSessions.forEach(session => allSessionNames.add(session.id));
    } else {
        // For split (enabled) groups:
        // 1. Check if we need to migrate from a merged file (e.g. settings changed or first sync after migration)
        const localGroupPath = makePath(LOCAL_SYNC_PATH, `${name}.json`);
        if (await storage.exists(localGroupPath)) {
            try {
                const content = await storage.readFile(localGroupPath);
                const data = JSON.parse(content);
                if (data && data.sessions) {
                    // Group by year
                    const byYear = {};
                    data.sessions.forEach(s => {
                        if (!byYear[s.year]) byYear[s.year] = [];
                        byYear[s.year].push(s);
                    });

                    // Write year files for years NOT processed in this sync
                    // (Processed years are already written by updateYearSync above)
                    const processedYears = new Set(years.map(y => y.name));
                    for (const [year, sessions] of Object.entries(byYear)) {
                        if (!processedYears.has(year)) {
                            await updateYearSync(name, year, sessions);
                        }
                    }
                }
            } catch (err) {
                console.error("Error migrating from merged file", err);
            }
            // 2. Delete local merged file
            await storage.deleteFile(localGroupPath);

            // 3. Delete remote merged file from AWS
            const remoteGroupPath = makePath(SYNC_BASE_PATH, `${name}.json.gz`);
            try {
                if (await storage.exists(remoteGroupPath)) {
                    console.log(`[Sync] Deleting remote merged file: ${remoteGroupPath}`);
                    await storage.deleteFile(remoteGroupPath);
                    console.log(`[Sync] Successfully deleted remote merged file`);
                }
            } catch (err) {
                console.error(`[Sync] Error deleting remote merged file for ${name}:`, err);
            }
        }
    }

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
}
