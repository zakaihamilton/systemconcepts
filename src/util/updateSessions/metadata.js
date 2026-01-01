import storage from "@util/storage";
import { makePath } from "@util/path";
import { LOCAL_SYNC_PATH } from "@sync/constants";

async function loadMetadata(property, extension, year, name, path, forceUpdate, isMerged, isBundled) {
    const sessionMetadataMap = {};
    let updateLocalMetadata = forceUpdate;

    if (!forceUpdate) {
        let metadataLoaded = false;
        const metadataLoader = (data) => {
            if (data && Array.isArray(data.sessions)) {
                data.sessions.forEach(session => {
                    if (session && session[property]) {
                        // Check if array has length for tags, or if value exists for others
                        const hasValue = Array.isArray(session[property]) ? session[property].length > 0 : session[property];
                        if (hasValue) {
                            sessionMetadataMap[session.id] = session[property];
                            if (session.name) {
                                sessionMetadataMap[session.name] = session[property];
                                if (session.name.startsWith(year.name)) {
                                    metadataLoaded = true;
                                }
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
                    metadataLoader(data);
                }
            }

            if (!metadataLoaded && isMerged) {
                const mergedPath = makePath(LOCAL_SYNC_PATH, `${name}.json`);
                if (await storage.exists(mergedPath)) {
                    const content = await storage.readFile(mergedPath);
                    const data = JSON.parse(content);
                    metadataLoader(data);
                }
            }

            if (!metadataLoaded) {
                const localYearPath = makePath(LOCAL_SYNC_PATH, name, `${year.name}.json`);
                if (await storage.exists(localYearPath)) {
                    const content = await storage.readFile(localYearPath);
                    const data = JSON.parse(content);
                    metadataLoader(data);
                }
            }

            if (!metadataLoaded) {
                updateLocalMetadata = true;
            }

        } catch (err) {
            console.warn(`[Sync] Failed to read cache for ${property}`, err);
        }
    }

    if (updateLocalMetadata) {
        const metadataFileName = `${year.name}${extension}`;
        const metadataRemotePath = makePath(path, metadataFileName);
        if (await storage.exists(metadataRemotePath)) {
            try {
                const content = await storage.readFile(metadataRemotePath);
                const data = JSON.parse(content);
                if (data && Array.isArray(data.sessions)) {
                    data.sessions.forEach(session => {
                        if (session.sessionName && session[property]) {
                            sessionMetadataMap[session.sessionName] = session[property];
                        }
                    });
                }
            } catch (err) {
                console.error(`[Sync] Error reading ${property} file ${metadataRemotePath}:`, err);
            }
        }
    }
    return sessionMetadataMap;
}

export async function loadTags(year, name, path, forceUpdate, isMerged, isBundled) {
    return loadMetadata("tags", ".tags", year, name, path, forceUpdate, isMerged, isBundled);
}

export async function loadDurations(year, name, path, forceUpdate, isMerged, isBundled) {
    return loadMetadata("duration", ".duration", year, name, path, forceUpdate, isMerged, isBundled);
}
