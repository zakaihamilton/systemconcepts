import storage from "@util/storage";
import { readCompressedFile, writeCompressedFile } from "./bundle";
import { lockMutex } from "./mutex";

const GROUPS_FILE_PATH = "local/sync/groups.json";

/**
 * Read groups from local storage
 * @returns {Promise<Object>} { groups: Array, settings: Object, version: number }
 */
export async function readGroups() {
    const unlock = await lockMutex({ id: "groups_rw" });
    try {
        if (!await storage.exists(GROUPS_FILE_PATH)) {
            return { groups: [], settings: {}, version: 1 };
        }

        const data = await readCompressedFile(GROUPS_FILE_PATH);
        return {
            groups: Array.isArray(data?.groups) ? data.groups : [],
            settings: data?.settings || {},
            version: data?.version || 1
        };
    } catch (err) {
        console.error("[Groups] Error reading groups:", err);
        return { groups: [], settings: {}, version: 1 };
    } finally {
        unlock();
    }
}

/**
 * Write groups to local storage
 * @param {Object} data - { groups: Array, settings: Object }
 */
export async function writeGroups(data) {
    const unlock = await lockMutex({ id: "groups_rw" });
    try {
        const content = {
            version: 1,
            groups: data.groups || [],
            settings: data.settings || {}
        };
        await writeCompressedFile(GROUPS_FILE_PATH, content);
    } catch (err) {
        console.error("[Groups] Error writing groups:", err);
        throw err;
    } finally {
        unlock();
    }
}
