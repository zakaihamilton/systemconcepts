import storage from "@util/storage";
import { makePath } from "@util/path";
import { LOCAL_SYNC_PATH } from "@sync/constants";
import JSZip from "jszip";
import { readBinary } from "@util/binary";

async function loadFromCache(property, name, year, isMerged, isBundled, loader, isLoaded) {
    try {
        if (isBundled) {
            const bundlePath = makePath(LOCAL_SYNC_PATH, "bundle.json");
            if (await storage.exists(bundlePath)) {
                const content = await storage.readFile(bundlePath);
                const data = JSON.parse(content);
                loader(data);
            }
        }

        if (!isLoaded() && isMerged) {
            const mergedPath = makePath(LOCAL_SYNC_PATH, `${name}.json`);
            if (await storage.exists(mergedPath)) {
                const content = await storage.readFile(mergedPath);
                const data = JSON.parse(content);
                loader(data);
            }
        }

        if (!isLoaded()) {
            const localYearPath = makePath(LOCAL_SYNC_PATH, name, `${year.name}.json`);
            if (await storage.exists(localYearPath)) {
                const content = await storage.readFile(localYearPath);
                const data = JSON.parse(content);
                loader(data);
            }
        }
    } catch (err) {
        console.warn(`[Sync] Failed to read cache for ${property}`, err);
    }
}

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
                            let value = session[property];
                            if (property === "tags" && Array.isArray(value)) {
                                value = value.map(tag => typeof tag === "string" ? tag.trim().replace(/\.+$/, "") : tag).filter(tag => tag);
                            }
                            sessionMetadataMap[session.id] = value;
                            if (session.name) {
                                sessionMetadataMap[session.name] = value;

                                if (session.name.startsWith(year.name)) {
                                    metadataLoaded = true;
                                }
                            }
                        }
                    }
                });
            }
        };

        await loadFromCache(property, name, year, isMerged, isBundled, metadataLoader, () => metadataLoaded);

        if (!metadataLoaded) {
            updateLocalMetadata = true;
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
                throw err;
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

export async function loadSummaries(year, name, path, forceUpdate, isMerged, isBundled) {
    const sessionMetadataMap = Object.create(null);
    let updateLocalMetadata = forceUpdate;
    const property = "summaryText";

    if (!forceUpdate) {
        let metadataLoaded = false;
        const metadataLoader = (data) => {
            if (data && Array.isArray(data.sessions)) {
                data.sessions.forEach(session => {
                    if (session && session[property]) {
                        const value = session[property];
                        if (value) {
                            sessionMetadataMap[session.id] = value;
                            if (session.name) {
                                sessionMetadataMap[session.name] = value;
                                if (session.name.startsWith(year.name)) {
                                    metadataLoaded = true;
                                }
                            }
                        }
                    }
                });
            }
        };

        await loadFromCache(property, name, year, isMerged, isBundled, metadataLoader, () => metadataLoaded);

        if (!metadataLoaded) {
            updateLocalMetadata = true;
        }
    }

    if (updateLocalMetadata) {
        const metadataFileName = `${year.name}.md`;
        const metadataRemotePath = makePath(path, metadataFileName);
        if (await storage.exists(metadataRemotePath)) {
            try {
                const content = await storage.readFile(metadataRemotePath);

                const lines = content.split('\n');
                let currentSessionId = null;
                let currentBuffer = [];

                const saveCurrentBuffer = () => {
                    if (currentSessionId && currentBuffer.length > 0) {
                        sessionMetadataMap[currentSessionId] = currentBuffer.join('\n').trim();
                    }
                };

                for (const line of lines) {
                    if (line.startsWith('## ')) {
                        saveCurrentBuffer();

                        const header = line.substring(3).trim();
                        // header usually is "YYYY-MM-DD Title" which matches session ID
                        if (/^\d{4}-\d{2}-\d{2}/.test(header)) {
                            currentSessionId = header;
                            currentBuffer = [];
                        } else {
                            currentSessionId = null;
                        }
                    } else if (currentSessionId) {
                        if (line.trim() === '---') continue;
                        currentBuffer.push(line);
                    }
                }
                saveCurrentBuffer();
            } catch (err) {
                console.error(`[Sync] Error reading ${property} file ${metadataRemotePath}:`, err);
                throw err;
            }
        }
    }
    return sessionMetadataMap;
}

export async function loadTranscriptions(year, name, path, forceUpdate, isMerged, isBundled) {
    const sessionMetadataMap = Object.create(null);
    let updateLocalMetadata = forceUpdate;
    const property = "transcription";

    if (!forceUpdate) {
        let metadataLoaded = false;
        const metadataLoader = (data) => {
            if (data && Array.isArray(data.sessions)) {
                data.sessions.forEach(session => {
                    if (session && session[property]) {
                        const value = session[property];
                        if (value) {
                            sessionMetadataMap[session.id] = value;
                            if (session.name) {
                                sessionMetadataMap[session.name] = value;
                                if (session.name.startsWith(year.name)) {
                                    metadataLoaded = true;
                                }
                            }
                        }
                    }
                });
            }
        };

        await loadFromCache(property, name, year, isMerged, isBundled, metadataLoader, () => metadataLoaded);

        if (!metadataLoaded) {
            updateLocalMetadata = true;
        }
    }

    if (updateLocalMetadata) {
        const metadataFileName = `${year.name}.zip`;
        const metadataRemotePath = makePath(path, metadataFileName);
        if (await storage.exists(metadataRemotePath)) {
            try {
                const blob = await readBinary(metadataRemotePath);
                if (blob) {
                    const zip = new JSZip();
                    await zip.loadAsync(blob);

                    zip.forEach((relativePath, zipEntry) => {
                        if (!zipEntry.dir && relativePath.endsWith('.txt')) {
                            // Extract the session ID from the filename
                            // Format is usually: "YYYY-MM-DD Title.txt" or just the session ID
                            const id = relativePath.replace(/\.txt$/, '');
                            sessionMetadataMap[id] = true;
                        }
                    });
                }
            } catch (err) {
                console.error(`[Sync Transcription] Error reading ${property} file ${metadataRemotePath}:`, err);
                // Don't throw, as the zip might simply not exist yet or be corrupted, 
                // but we should still allow sync to continue
            }
        }
    }
    return sessionMetadataMap;
}
