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
        let allGroups = new Set();

        const groupsPath = makePath("local/sync/groups.json");
        if (await storage.exists(groupsPath)) {
            try {
                const content = await storage.readFile(groupsPath);
                const data = JSON.parse(content);
                const groups = data.groups || [];

                for (const g of groups) {
                    allGroups.add(g.name);
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

        const splitCount = allGroups.size - bundledGroups.size - mergedGroups.size;
        addSyncLog(`[Personal] Loaded ${allGroups.size} group(s) for filtering (${bundledGroups.size} bundled, ${mergedGroups.size} merged, ${splitCount} split)`, "info");


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
            // Storage paths have leading slash, LOCAL_PERSONAL_PATH doesn't, so strip leading slash
            if (relPath.startsWith("/")) {
                relPath = relPath.substring(1);
            }

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

                        // If groups loaded, check if group exists and is bundled/merged
                        // If groups not loaded, include file (fallback to safe behavior)
                        if (allGroups.size === 0) {
                            return true; // Fallback: include if groups not loaded
                        }
                        const isKnown = allGroups.has(groupName);
                        const isBundled = bundledGroups.has(groupName);
                        const isMerged = mergedGroups.has(groupName);
                        const shouldInclude = isKnown && (isBundled || isMerged);

                        if (shouldInclude) {
                            return true;
                        }
                        return false;
                    } else {
                        // This is inside a group folder
                        const groupName = groupPart;

                        // If groups loaded, check if group exists and is split
                        // If groups not loaded, check file structure (fallback)
                        const groupsLoaded = allGroups.size > 0;
                        const isKnownGroup = groupsLoaded ? allGroups.has(groupName) : true;
                        const isSplitGroup = groupsLoaded ? (!bundledGroups.has(groupName) && !mergedGroups.has(groupName)) : true;

                        if (isKnownGroup && isSplitGroup) {
                            // For split groups, we now organize by year
                            // Structure is: metadata/sessions/group/year.json
                            // or could be legacy: metadata/sessions/group/year/session.json
                            if (parts.length === 4 && parts[3].endsWith(".json")) {
                                // This is a year bundle file: metadata/sessions/group/year.json
                                return true;
                            } else if (parts.length > 4) {
                                // This is a legacy individual session file (shouldn't exist after migration)
                                // Skip these as they should have been migrated to year bundles
                                return false;
                            }
                        }
                        return false;
                    }
                }
            }

            return true;
        }).map(item => {
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
