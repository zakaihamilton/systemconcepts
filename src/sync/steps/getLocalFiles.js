import storage from "@util/storage";
import { LOCAL_SYNC_PATH, FILES_MANIFEST } from "../constants";
import { addSyncLog } from "../logs";

/**
 * Step 1: Read the listing of the sync folder (ignoring the files.json)
 */
export async function getLocalFiles() {
    const start = performance.now();
    addSyncLog("Step 1: Reading local files...", "info");

    try {
        const listing = await storage.getRecursiveList(LOCAL_SYNC_PATH);
        const files = listing.filter(item =>
            item.type !== "dir" &&
            item.name !== FILES_MANIFEST &&
            !item.name.endsWith(".DS_Store") &&
            // Only allow year-based tag files e.g. "2021.tags", not individual session tags
            (!item.name.endsWith(".tags") || /^\d{4}\.tags$/.test(item.name))
        ).map(item => {
            const relPath = item.path.substring(LOCAL_SYNC_PATH.length + 1);
            return {
                path: relPath,
                fullPath: item.path
            };
        });

        const duration = ((performance.now() - start) / 1000).toFixed(1);
        addSyncLog(`✓ Found ${files.length} local file(s) in ${duration}s`, "info");
        return files;
    } catch (err) {
        console.error("[Sync] Step 1 error:", err);
        throw err;
    }
}
