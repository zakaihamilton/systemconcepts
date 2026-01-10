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
     * @param {string} relPath Relative path (e.g., group.json or group/2024.json)
     */
    shouldIncludeFile(relPath) {
        // If groups failed to load or are empty, default to including everything (safe fallback)
        if (!this.loaded || this.allGroups.size === 0) {
            return true;
        }

        if (relPath === "bundle.json") {
            return true;
        }

        const parts = relPath.split("/");

        // Normalize legacy paths for filtering checks
        // We want to apply the same bundled/merged logic even to legacy files
        if (relPath.startsWith("metadata/sessions/")) {
            const cleanPath = relPath.substring("metadata/sessions/".length);
            // Re-split the clean path to check 1 or 2 parts logic below
            // Recursive call or just reset 'parts' variable?
            // Resetting parts variable is safer as the logic below uses 'parts'
            const cleanParts = cleanPath.split("/");

            // Handle 1 part (file) logic
            if (cleanParts.length === 1) {
                const fileName = cleanParts[0];
                if (fileName.endsWith(".json")) {
                    const groupName = fileName.replace(".json", "");
                    const isKnown = this.allGroups.has(groupName);
                    const isBundled = this.bundledGroups.has(groupName);
                    const isMerged = this.mergedGroups.has(groupName);
                    return isKnown && !isBundled && isMerged;
                }
            }
            // Handle 2 parts (directory) logic
            else if (cleanParts.length === 2) {
                const groupName = cleanParts[0];
                const fileName = cleanParts[1];
                if (fileName.endsWith(".json")) {
                    const isKnown = this.allGroups.has(groupName);
                    const isBundled = this.bundledGroups.has(groupName);
                    const isMerged = this.mergedGroups.has(groupName);
                    return isKnown && !isBundled && !isMerged;
                }
            }
            // If legacy path doesn't match standard structure, exclude it (strict)
            return false;
        }

        // Single file: group.json
        if (parts.length === 1) {
            const fileName = parts[0];
            if (fileName.endsWith(".json")) {
                const groupName = fileName.replace(".json", "");

                const isKnown = this.allGroups.has(groupName);
                const isBundled = this.bundledGroups.has(groupName);
                const isMerged = this.mergedGroups.has(groupName);

                // Include ONLY if it is:
                // 1. A known group
                // 2. NOT bundled (bundled groups are in a separate common file)
                // 3. AND Merged (merged groups are single files)
                return isKnown && !isBundled && isMerged;
            }
        }
        // Folder: group/2024.json
        else if (parts.length === 2) {
            const groupName = parts[0];
            const fileName = parts[1];

            if (fileName.endsWith(".json")) {
                const isKnown = this.allGroups.has(groupName);
                const isBundled = this.bundledGroups.has(groupName);
                const isMerged = this.mergedGroups.has(groupName);

                // Include ONLY if it is:
                // 1. A known group
                // 2. NOT bundled
                // 3. AND NOT merged (merged groups are single files)
                return isKnown && !isBundled && !isMerged;
            }
        }

        return false;
    }
}
