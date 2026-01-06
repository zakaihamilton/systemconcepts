import storage from "@util/storage";
import { LOCAL_PERSONAL_PATH, LOCAL_PERSONAL_MANIFEST } from "../constants";
import { addSyncLog } from "@sync/logs";

/**
 * Step 1: Read the listing of the personal folder (ignoring the files.json)
 */
export async function getLocalFiles() {
    const start = performance.now();
    addSyncLog("[Personal] Step 1: Reading local personal files...", "info");

    try {
        const listing = await storage.getRecursiveList(LOCAL_PERSONAL_PATH);
        const files = listing.filter(item =>
            item.type !== "dir" &&
            item.name !== LOCAL_PERSONAL_MANIFEST &&
            item.name !== "migration.json" &&
            item.name !== "migration.json.tmp" &&
            !item.name.endsWith(".DS_Store")
        ).map(item => {
            const relPath = item.path.substring(LOCAL_PERSONAL_PATH.length + 1);
            return {
                path: relPath,
                fullPath: item.path
            };
        });

        const duration = ((performance.now() - start) / 1000).toFixed(1);
        addSyncLog(`[Personal] ✓ Found ${files.length} local personal file(s) in ${duration}s`, "info");
        return files;
    } catch (err) {
        console.error("[Personal Sync] Step 1 error:", err);
        throw err;
    }
}
