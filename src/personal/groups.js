import storage from "@util/storage";
import { makePath } from "@util/path";

export class GroupFilter {
    constructor() {
        this.bundledGroups = new Set();
        this.mergedGroups = new Set();
        this.allGroups = new Set();
        this.loaded = false;
    }

    async load() {
        if (this.loaded) return;

        try {
            const groupsPath = makePath("local/sync/groups.json");
            if (await storage.exists(groupsPath)) {
                const content = await storage.readFile(groupsPath);
                const data = JSON.parse(content);
                const groups = data.groups || [];

                for (const g of groups) {
                    this.allGroups.add(g.name);
                    if (g.bundled) {
                        this.bundledGroups.add(g.name);
                    } else if (g.merged) {
                        this.mergedGroups.add(g.name);
                    }
                }
            }
            this.loaded = true;
        } catch (err) {
            console.error("[Personal] Error loading groups for filtering:", err);
        }
    }

    /**
     * Check if a file path should be included based on group active/bundled/merged state
     * @param {string} relPath Relative path (e.g., metadata/sessions/group.json)
     */
    shouldIncludeFile(relPath) {
        // If groups failed to load or are empty, default to including everything (safe fallback)
        if (!this.loaded || this.allGroups.size === 0) {
            return true;
        }

        // Only filter metadata/sessions files
        if (!relPath.startsWith("metadata/sessions/")) {
            return true;
        }

        const parts = relPath.split("/");
        // parts[0] is "metadata", parts[1] is "sessions"
        // parts[2] is either group name (file) or group name (folder)

        if (parts.length >= 3) {
            const groupPart = parts[2];

            if (groupPart.endsWith(".json")) {
                // This is a bundle/merged file: metadata/sessions/group.json
                const groupName = groupPart.replace(".json", "");

                const isKnown = this.allGroups.has(groupName);
                const isBundled = this.bundledGroups.has(groupName);
                const isMerged = this.mergedGroups.has(groupName);

                // Include ONLY if it is a known group AND it is bundled or merged
                return isKnown && (isBundled || isMerged);
            } else {
                // This is inside a group folder: metadata/sessions/group/2024.json
                const groupName = groupPart;

                const isKnown = this.allGroups.has(groupName);
                const isBundled = this.bundledGroups.has(groupName);
                const isMerged = this.mergedGroups.has(groupName);

                // Include ONLY if it is a known group AND it is NOT bundled/merged (i.e. Split)
                return isKnown && !isBundled && !isMerged;
            }
        }

        return true;
    }
}
