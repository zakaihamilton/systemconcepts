import storage from "@util/storage";
import { makePath } from "@util/path";
import { LOCAL_PERSONAL_PATH, LOCAL_PERSONAL_MANIFEST } from "../constants";
import { addSyncLog } from "@sync/logs";

/**
 * Step 1: Read the listing of the personal folder (ignoring the files.json)
 */
export async function getLocalFiles() {
    const start = performance.now();
    addSyncLog("[Personal] Step 1: Reading local personal files...", "info");

    try {
        // Load groups to check for bundled/merged status
        let bundledGroups = new Set();
        let mergedGroups = new Set();

        const groupsPath = makePath("local/sync/groups.json");
        if (await storage.exists(groupsPath)) {
            try {
                const content = await storage.readFile(groupsPath);
                const data = JSON.parse(content);
                const groups = data.groups || [];

                for (const g of groups) {
                    if (g.bundled) {
                        bundledGroups.add(g.name);
                    } else if (g.merged) {
                        mergedGroups.add(g.name);
                    }
                }
            } catch (err) {
                console.error("[Personal] Error loading groups for file filtering:", err);
            }
        }

        const listing = await storage.getRecursiveList(LOCAL_PERSONAL_PATH);
        const files = listing.filter(item => {
            if (item.type === "dir" ||
                item.name === LOCAL_PERSONAL_MANIFEST ||
                item.name === "migration.json" ||
                item.name === "migration.json.tmp" ||
                item.name.endsWith(".DS_Store")) {
                return false;
            }

            let relPath = item.path.substring(LOCAL_PERSONAL_PATH.length + 1);

            // Filter metadata/sessions files based on group config
            if (relPath.startsWith("metadata/sessions/")) {
                const parts = relPath.split("/");
                // parts[0] is "metadata", parts[1] is "sessions"
                // parts[2] is either group name (file) or group name (folder)

                if (parts.length >= 3) {
                    const groupPart = parts[2];

                    if (groupPart.endsWith(".json")) {
                        // This is a bundle/merged file: metadata/sessions/group.json
                        const groupName = groupPart.replace(".json", "");
                        // Only include if group is bundled or merged
                        if (bundledGroups.has(groupName) || mergedGroups.has(groupName)) {
                            return true;
                        }
                        return false;
                    } else {
                        // This is inside a group folder: metadata/sessions/group/session.json
                        const groupName = groupPart;
                        // Only include if group is NOT bundled AND NOT merged (i.e. split)
                        if (!bundledGroups.has(groupName) && !mergedGroups.has(groupName)) {
                            return true;
                        }
                        return false;
                    }
                }
            }

            return true;
        }).map(item => {
            // Map local path (metadata/sessions/...) to remote key (sessions/...)
            let relPath = item.path.substring(LOCAL_PERSONAL_PATH.length + 1);
            if (relPath.startsWith("metadata/sessions/")) {
                relPath = relPath.substring("metadata/".length);
            }
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
