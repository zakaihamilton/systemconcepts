import storage from "@util/storage";
import { makePath } from "@util/path";
import { writeCompressedFile } from "@sync/bundle";
import { LOCAL_SYNC_PATH } from "@sync/constants";

export async function getListing(path) {
    let listing = await storage.getListing(path);
    if (!listing) {
        return [];
    }
    return listing;
}

export async function updateYearSync(groupName, year, sessions) {
    if (!sessions || sessions.length === 0) {
        return 0;
    }
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

export async function updateBundleFile(newSessions) {
    const bundlePath = makePath(LOCAL_SYNC_PATH, "bundle.json");
    let allSessions = [];

    // 1. Read existing bundle
    try {
        if (await storage.exists(bundlePath)) {
            const content = await storage.readFile(bundlePath);
            const data = JSON.parse(content);
            if (data && Array.isArray(data.sessions)) {
                allSessions = data.sessions;
            }
        }
    } catch (err) {
        console.warn("[Sync] Failed to read existing bundle for update", err);
    }

    // 2. Remove old sessions for groups that we are updating
    const updatedGroups = new Set(newSessions.map(s => s.group));
    allSessions = allSessions.filter(s => !updatedGroups.has(s.group));

    // 3. Add new sessions
    allSessions.push(...newSessions);

    // 4. Write bundle
    const bundleData = {
        version: 1,
        date: Date.now(),
        sessions: allSessions
    };
    await writeCompressedFile(bundlePath, bundleData);
    console.log(`[Sync] Updated bundle.json with ${newSessions.length} new sessions. Total: ${allSessions.length}`);
}
