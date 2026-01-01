import storage from "@util/storage";
import { makePath } from "@util/path";
import { LOCAL_SYNC_PATH } from "@sync/constants";

export async function loadTags(year, name, path, updateTags, isMerged, isBundled) {
    const sessionTagsMap = {};
    let updateLocalTags = updateTags;

    if (!updateTags) {
        let tagsLoaded = false;
        const tagLoader = (data) => {
            if (data && Array.isArray(data.sessions)) {
                data.sessions.forEach(session => {
                    if (session && session.tags && session.tags.length) {
                        sessionTagsMap[session.id] = session.tags;
                        if (session.name) {
                            sessionTagsMap[session.name] = session.tags;
                            if (session.name.startsWith(year.name)) {
                                tagsLoaded = true;
                            }
                        }
                    }
                });
            }
        };

        try {
            if (isBundled) {
                const bundlePath = makePath(LOCAL_SYNC_PATH, "bundle.json");
                if (await storage.exists(bundlePath)) {
                    const content = await storage.readFile(bundlePath);
                    const data = JSON.parse(content);
                    tagLoader(data);
                }
            }

            // Check merged if not bundled or not found in bundle
            if (!tagsLoaded && isMerged) {
                const mergedPath = makePath(LOCAL_SYNC_PATH, `${name}.json`);
                if (await storage.exists(mergedPath)) {
                    const content = await storage.readFile(mergedPath);
                    const data = JSON.parse(content);
                    tagLoader(data);
                }
            }

            if (!tagsLoaded) {
                const localYearPath = makePath(LOCAL_SYNC_PATH, name, `${year.name}.json`);
                if (await storage.exists(localYearPath)) {
                    const content = await storage.readFile(localYearPath);
                    const data = JSON.parse(content);
                    tagLoader(data);
                }
            }

            if (!tagsLoaded) {
                updateLocalTags = true;
            }

        } catch (err) {
            console.warn(`[Sync] Failed to read cache for tags`, err);
        }
    }

    if (updateLocalTags) {
        const tagFileName = `${year.name}.tags`;
        const tagRemotePath = makePath(path, tagFileName);
        if (await storage.exists(tagRemotePath)) {
            try {
                const content = await storage.readFile(tagRemotePath);
                const data = JSON.parse(content);
                if (data && Array.isArray(data.sessions)) {
                    data.sessions.forEach(session => {
                        if (session.sessionName && session.tags) {
                            sessionTagsMap[session.sessionName] = session.tags;
                        }
                    });
                }
            } catch (err) {
                console.error(`[Sync] Error reading tags file ${tagRemotePath}:`, err);
            }
        }
    }
    return sessionTagsMap;
}

export async function loadDurations(year, name, path, updateTags, isMerged, isBundled) {
    const sessionDurationMap = {};
    let updateLocalDurations = updateTags;

    if (!updateTags) {
        let durationsLoaded = false;
        const durationLoader = (data) => {
            if (data && Array.isArray(data.sessions)) {
                data.sessions.forEach(session => {
                    if (session && session.duration) {
                        sessionDurationMap[session.id] = session.duration;
                        if (session.name) {
                            sessionDurationMap[session.name] = session.duration;
                            if (session.name.startsWith(year.name)) {
                                durationsLoaded = true;
                            }
                        }
                    }
                });
            }
        };

        try {
            if (isBundled) {
                const bundlePath = makePath(LOCAL_SYNC_PATH, "bundle.json");
                if (await storage.exists(bundlePath)) {
                    const content = await storage.readFile(bundlePath);
                    const data = JSON.parse(content);
                    durationLoader(data);
                }
            }

            if (!durationsLoaded && isMerged) {
                const mergedPath = makePath(LOCAL_SYNC_PATH, `${name}.json`);
                if (await storage.exists(mergedPath)) {
                    const content = await storage.readFile(mergedPath);
                    const data = JSON.parse(content);
                    durationLoader(data);
                }
            }

            if (!durationsLoaded) {
                const localYearPath = makePath(LOCAL_SYNC_PATH, name, `${year.name}.json`);
                if (await storage.exists(localYearPath)) {
                    const content = await storage.readFile(localYearPath);
                    const data = JSON.parse(content);
                    durationLoader(data);
                }
            }

            if (!durationsLoaded) {
                updateLocalDurations = true;
            }

        } catch (err) {
            console.warn(`[Sync] Failed to read cache for durations`, err);
        }
    }

    if (updateLocalDurations) {
        const durationFileName = `${year.name}.duration`;
        const durationRemotePath = makePath(path, durationFileName);
        if (await storage.exists(durationRemotePath)) {
            try {
                const content = await storage.readFile(durationRemotePath);
                const data = JSON.parse(content);
                if (data && Array.isArray(data.sessions)) {
                    data.sessions.forEach(session => {
                        if (session.sessionName && session.duration) {
                            sessionDurationMap[session.sessionName] = session.duration;
                        }
                    });
                }
            } catch (err) {
                console.error(`[Sync] Error reading durations file ${durationRemotePath}:`, err);
            }
        }
    }
    return sessionDurationMap;
}
