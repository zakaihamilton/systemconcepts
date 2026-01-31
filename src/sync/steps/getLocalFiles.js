import storage from "@util/storage";
import { makePath } from "@util/path";
import { LOCAL_SYNC_PATH, FILES_MANIFEST } from "../constants";
import { addSyncLog } from "../logs";

/**
 * Step 1: Read the listing of the sync folder (ignoring the files.json)
 * @param {string} localPath - The local path to sync
 */
export async function getLocalFiles(localPath = LOCAL_SYNC_PATH, config = {}) {
    const start = performance.now();
    addSyncLog("Step 1: Reading local files...", "info");

    try {
        const listing = await storage.getRecursiveList(localPath);
        const files = listing.filter(item =>
            item.type !== "dir" &&
            item.name !== FILES_MANIFEST &&
            !item.name.endsWith(".DS_Store") &&
            // Only allow year-based tag files e.g. "2021.tags" if tags filter is enabled
            (!item.name.endsWith(".tags") || (config.filters?.tags && /^\d{4}\.tags$/.test(item.name)))
        ).map(item => {
            const prefix = makePath(localPath);
            let relPath = item.path.substring(prefix.length);
            if (!relPath.startsWith("/")) {
                relPath = "/" + relPath;
            }
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
