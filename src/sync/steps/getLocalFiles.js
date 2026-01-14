import storage from "@util/storage";
import { makePath } from "@util/path";
import { LOCAL_SYNC_PATH, FILES_MANIFEST } from "../constants";
import { addSyncLog } from "../logs";

/**
 * Step 1: Read the listing of the sync folder (ignoring the files.json)
 * @param {string} localPath - The local path to sync
 * @param {string[]} excludePaths - Array of relative paths to exclude (e.g., ['/library'])
 */
export async function getLocalFiles(localPath = LOCAL_SYNC_PATH, excludePaths = []) {
    const start = performance.now();
    addSyncLog("Step 1: Reading local files...", "info");

    try {
        const listing = await storage.getRecursiveList(localPath);
        const files = listing.filter(item => {
            // Filter out directories
            if (item.type === "dir") return false;

            // Filter out manifest
            if (item.name === FILES_MANIFEST) return false;

            // Filter out .DS_Store
            if (item.name.endsWith(".DS_Store")) return false;

            // Only allow year-based tag files e.g. "2021.tags", not individual session tags
            if (item.name.endsWith(".tags") && !/^\d{4}\.tags$/.test(item.name)) return false;

            // Check if path should be excluded
            const prefix = makePath(localPath);
            let relPath = item.path.substring(prefix.length);
            if (!relPath.startsWith("/")) {
                relPath = "/" + relPath;
            }

            // Exclude paths that start with any of the excluded paths
            for (const excludePath of excludePaths) {
                if (relPath.startsWith(excludePath)) {
                    return false;
                }
            }

            return true;
        }).map(item => {
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
