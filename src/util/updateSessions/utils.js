import storage from "@util/storage";
import { makePath } from "@util/path";
import { writeCompressedFile } from "@sync/bundle";
import { LOCAL_SYNC_PATH } from "@sync/constants";

export async function getListing(path) {
    console.log(`[getListing] Requesting listing for: ${path}`);
    let listing = await storage.getListing(path);
    console.log(`[getListing] Received listing with ${listing?.length || 0} items for: ${path}`);
    if (!listing) {
        console.warn(`[getListing] No listing returned for: ${path}`);
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
            } catch {
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
        let newCount = 0;
        if (await storage.exists(localPath)) {
            const existingContent = await storage.readFile(localPath);
            try {
                const existingObj = JSON.parse(existingContent);
                const exSessions = JSON.stringify(existingObj.sessions);

                // Calculate newCount even if specific content matches, just to be safe, 
                // but usually we rely on "something changed". 
                // However, diffing logic is needed for newCount.
                const existingIds = new Set((existingObj.sessions || []).map(s => s.name || s.id));
                newCount = data.sessions.filter(s => !existingIds.has(s.name || s.id)).length;

                const newSessions = JSON.stringify(data.sessions);
                if (exSessions === newSessions && existingObj.group === data.group) {
                    return { counter: 0, newCount: 0 };
                }
            } catch {
                // if parse fails, overwrite
                newCount = data.sessions.length; // Assume all are new if existing corrupt
            }
        } else {
            newCount = data.sessions.length; // All are new
        }

        await writeCompressedFile(localPath, data);
        return { counter: data.counter, newCount };
    } catch (err) {
        console.error(`[Sync] Error updating year sync ${groupName}/${year}:`, err);
        return { counter: 0, newCount: 0 };
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
        console.error("[Sync] Failed to read existing bundle for update", err);
        throw err;
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
