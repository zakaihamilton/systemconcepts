import { readFile, writeFile } from "./files";

const GROUPS_FILE = "groups.json";

/**
 * Read groups from local storage
 * @returns {Promise<Object>} { groups: Array, settings: Object, version: number }
 */
export async function readGroups() {
    try {
        const data = await readFile(GROUPS_FILE);
        return {
            groups: data?.groups || [],
            settings: data?.settings || {},
            version: data?.version || 1
        };
    } catch (err) {
        console.error("[Groups] Error reading groups:", err);
        return { groups: [], settings: {}, version: 1 };
    }
}

/**
 * Write groups to local storage
 * @param {Object} data - { groups: Array, settings: Object }
 */
export async function writeGroups(data) {
    try {
        const content = {
            version: 1,
            groups: data.groups || [],
            settings: data.settings || {}
        };
        await writeFile(GROUPS_FILE, content);
    } catch (err) {
        console.error("[Groups] Error writing groups:", err);
        throw err;
    }
}
