import storage from "@util/storage";
import { makePath } from "@util/path";
import { addSyncLog } from "@sync/logs";
import { calculateHash } from "@sync/hash";
import { readGroups } from "@sync/groups";
import { SyncActiveStore } from "@sync/syncState";
import { LOCAL_PERSONAL_PATH, PERSONAL_MANIFEST, LOCAL_PERSONAL_MANIFEST } from "../constants";

const MIGRATION_FILE = "migration.json";

/**
 * Step 3.5: Migrate personal files from MongoDB to AWS S3
 * Uses local migration.json to track progress and allow resumable migration
 * Files are copied to local storage immediately so user sees progress
 */
export async function migrateFromMongoDB(userid, remoteManifest, basePath) {
    const start = performance.now();
    const migrationPath = makePath(LOCAL_PERSONAL_PATH, MIGRATION_FILE);
    const localManifestPath = makePath(LOCAL_PERSONAL_PATH, LOCAL_PERSONAL_MANIFEST);

    try {
        // Load or create migration state
        const mongoPath = "personal/metadata/sessions";
        let migrationState = { files: [], migrated: {}, complete: false };

        if (await storage.exists(migrationPath)) {
            try {
                const content = await storage.readFile(migrationPath);
                console.log(`[Personal] Migration file exists, size: ${content?.length || 0} bytes`);
                if (!content || !content.trim()) {
                    throw new Error("Empty migration file");
                }
                migrationState = JSON.parse(content);

                // If migration is complete, skip
                if (migrationState.complete) {
                    console.log("[Personal] Migration already complete, skipping");
                    return { migrated: false, fileCount: 0, manifest: null, deletedKeys: [] };
                }

                addSyncLog(`[Personal] Resuming migration: ${Object.keys(migrationState.migrated).length}/${migrationState.files.length} done`, "info");
            } catch (err) {
                console.error("[Personal] Error loading migration state:", err);
                addSyncLog(`[Personal] Migration state file corrupted or empty, starting fresh: ${err.message}`, "warning");
                // State remains at default (initialized above)
            }
        }

        // If no files cached, scan MongoDB and cache them
        if (migrationState.files.length === 0) {
            addSyncLog("[Personal] Scanning MongoDB for files to migrate...", "info");



            if (!(await storage.exists(mongoPath))) {
                addSyncLog("[Personal] No MongoDB personal files found", "info");
                migrationState.complete = true;
                await storage.writeFile(migrationPath, JSON.stringify(migrationState, null, 2));
                return { migrated: false, fileCount: 0 };
            }

            const listing = await storage.getRecursiveList(mongoPath);
            const files = listing.filter(item =>
                item.type !== "dir" &&
                item.name &&
                item.name.trim() &&
                !item.name.endsWith(".DS_Store")
            );

            if (files.length === 0) {
                addSyncLog("[Personal] No files found in MongoDB", "info");
                migrationState.complete = true;
                await storage.writeFile(migrationPath, JSON.stringify(migrationState, null, 2));
                return { migrated: false, fileCount: 0 };
            }

            // Cache file list
            migrationState.files = files.map(f => ({
                path: f.path,
                mtimeMs: f.mtimeMs || Date.now()
            }));
            const stateContent = JSON.stringify(migrationState, null, 2);
            console.log(`[Personal] Writing migration state after caching: ${migrationState.files.length} files, ${stateContent.length} bytes`);
            await storage.writeFile(migrationPath, stateContent);

            // Verify write succeeded
            try {
                const verifyContent = await storage.readFile(migrationPath);
                console.log(`[Personal] Verification read: ${verifyContent?.length || 0} bytes`);
                if (!verifyContent || verifyContent.length === 0) {
                    console.error("[Personal] CRITICAL: Migration file write failed - file is empty after write!");
                }
            } catch (err) {
                console.error("[Personal] CRITICAL: Cannot verify migration file write:", err);
            }

            addSyncLog(`[Personal] Cached ${files.length} files for migration`, "info");
        }

        // Check usage of remoteManifest to skip already processed files
        // This handles the "Fresh Sync / Reset" scenario
        // We do this check before filtering filesToMigrate
        let autoMigratedCount = 0;


        // Helper to get expected manifest key
        const getManifestKey = (filePath) => {
            let relativePath = filePath.substring(mongoPath.length + 1);
            relativePath = relativePath.replace(/^[\/\\]+/, "");
            return `metadata/sessions/${relativePath}`;
        };

        // Helper to check bundling status
        // We need to know if a group is bundled to check for the BUNDLE file in manifest instead of individual file
        // We already loaded groups later, but we need them now.
        // Let's hoist the group loading logic up.



        // Load groups to check for bundled status
        let bundledGroups = new Set();
        try {
            const { groups } = await readGroups();
            if (groups) {
                groups.forEach(g => {
                    if (g.bundled || g.merged) {
                        bundledGroups.add(g.name);
                    }
                });
            }
        } catch (err) {
            console.error("[Personal] Error loading groups for bundling check:", err);
        }

        // Find files that haven't been migrated yet, checking remoteManifest first
        let hasNewSkippedFiles = false;

        // First pass: mark already-uploaded files as migrated
        for (const file of migrationState.files) {
            if (migrationState.migrated[file.path]) continue;

            let relativePath = file.path.substring("personal/metadata/sessions".length + 1);
            relativePath = relativePath.replace(/^[\/\\]+/, "");

            if (!relativePath || !relativePath.trim()) continue;

            const parts = relativePath.split("/");
            const groupName = parts[0];
            const isBundled = bundledGroups.has(groupName);

            let existsRemote = false;

            if (isBundled) {
                // Check if the group bundle exists in manifest
                const bundleKey = `metadata/sessions/${groupName}.json`;
                if (remoteManifest[bundleKey]) {
                    // Assume if bundle exists, the file is in it. 
                    // This is an optimization. Worst case if data missing, user can re-save.
                    existsRemote = true;
                }
            } else {
                const manifestKey = `metadata/sessions/${relativePath}`;
                if (remoteManifest[manifestKey]) {
                    existsRemote = true;
                }
            }

            if (existsRemote) {
                migrationState.migrated[file.path] = true;
                hasNewSkippedFiles = true;
                autoMigratedCount++;
            }
        }

        if (hasNewSkippedFiles) {
            addSyncLog(`[Personal] Linked ${autoMigratedCount} files to existing remote data`, "info");
            await storage.writeFile(migrationPath, JSON.stringify(migrationState, null, 2));
        }

        // NOW filter for work to do
        const filesToMigrate = migrationState.files.filter(f => !migrationState.migrated[f.path]);

        if (filesToMigrate.length === 0) {
            addSyncLog("[Personal] All files migrated!", "success");
            migrationState.complete = true;
            await storage.writeFile(migrationPath, JSON.stringify(migrationState, null, 2));
            // Still return manifest in case we need to upload cleaned entries
            return { migrated: false, fileCount: 0, manifest: null, deletedKeys: [] };
        }

        const total = migrationState.files.length;
        const done = total - filesToMigrate.length;
        addSyncLog(`[Personal] Migrating ${filesToMigrate.length} remaining files (${done}/${total} done)`, "info");

        // Load current local manifest to update it
        let manifest = { ...remoteManifest };
        if (await storage.exists(localManifestPath)) {
            try {
                const content = await storage.readFile(localManifestPath);
                const localManifest = JSON.parse(content);
                manifest = { ...manifest, ...localManifest };
            } catch (err) { }
        }

        const deletedKeys = [];

        // Repair Step: Check for and fix double slash paths in manifest/state
        // This handles files that were previously migrated incorrectly
        if (migrationState.files && migrationState.files.length > 0) {
            let repairCount = 0;


            for (const file of migrationState.files) {
                // Check if this file produced a double slash key
                // Old logic was substring without cleaning leading slash
                const rawRelativePath = file.path.substring(mongoPath.length + 1);

                // If the raw relative path starts with /, it caused a double slash //
                if (rawRelativePath.startsWith("/")) {
                    const badManifestKey = `metadata/sessions/${rawRelativePath}`;

                    if (manifest[badManifestKey]) {
                        // Found a bad entry - blacklist
                        delete manifest[badManifestKey];
                        deletedKeys.push(badManifestKey);

                        // Check if we ALREADY have the clean entry (e.g. from previous partial run)
                        // If so, we don't need to re-migrate, just clean the manifest
                        const cleanRelativePath = rawRelativePath.replace(/^[\/\\]+/, "");
                        const cleanManifestKey = `metadata/sessions/${cleanRelativePath}`;

                        const parts = cleanRelativePath.split("/");
                        const groupName = parts[0];
                        const isBundled = bundledGroups.has(groupName);

                        let cleanEntryExists = false;
                        if (isBundled) {
                            const bundleKey = `metadata/sessions/${groupName}.json`;
                            if (manifest[bundleKey]) {
                                cleanEntryExists = true;
                            }
                        } else {
                            if (manifest[cleanManifestKey]) {
                                cleanEntryExists = true;
                            }
                        }

                        if (!cleanEntryExists) {
                            // Force re-migration of this file only if we don't have a clean record of it
                            if (migrationState.migrated[file.path]) {
                                migrationState.migrated[file.path] = false;
                                migrationState.complete = false; // Mark migration as incomplete
                                repairCount++;
                            }
                        } else {
                            // We have the clean key (or bundle), just dropping the bad one. 
                            // No need to increment repairCount
                        }
                    }
                }
            }

            if (repairCount > 0) {
                addSyncLog(`[Personal] Found ${repairCount} files with double-slash paths. Queued for repair.`, "warning");
                // Save state immediately to ensure we don't lose the "unmigrated" status if crash
                await storage.writeFile(migrationPath, JSON.stringify(migrationState, null, 2));
            }
        }

        let migratedCount = 0;


        // bundledGroups already loaded at top of function

        // Bundle cache: { [groupName or group/year]: { content: { [relativePath]: data }, dirty: false } }
        const bundleCache = {};

        // Track individual file manifest keys to remove (they're now in bundles)
        const individualFilesToRemove = new Set();


        // Helper to flush bundles
        const flushBundles = async () => {
            for (const [cacheKey, cache] of Object.entries(bundleCache)) {
                if (cache.dirty) {
                    const bundlePath = makePath(LOCAL_PERSONAL_PATH, "metadata/sessions", `${cacheKey}.json`);
                    const awsBundlePath = makePath(basePath, "metadata/sessions", `${cacheKey}.json`);

                    // Read existing if not fully loaded? 
                    // We assume we are building it or appending. 
                    // Ideally we read existing first if we want to support partial updates, but migration is usually filling gaps.
                    // For safety, let's just write what we have. 
                    // However, if we migrated some files in previous run, they might be in the file already?
                    // Actually, if we write the WHOLE bundle every time, we need to know the whole state.
                    // But we only fetch "filesToMigrate".
                    // So we must read existing bundle first if it exists!

                    let fullBundle = cache.content;
                    if (await storage.exists(bundlePath)) {
                        try {
                            const existing = JSON.parse(await storage.readFile(bundlePath));
                            fullBundle = { ...existing, ...cache.content };
                        } catch (err) { }
                    }

                    const content = JSON.stringify(fullBundle, null, 2);
                    await storage.createFolderPath(bundlePath);
                    await storage.writeFile(bundlePath, content);
                    await storage.writeFile(awsBundlePath, content);

                    // Update manifest for the bundle file
                    // The individual files inside are NOT in the manifest anymore?
                    // Or do we keep them virtual?
                    // The Plan said: "Update manifest with bundle file."
                    // So we remove individual entries? 
                    // Users current manifest might have individual entries.
                    // We should add the bundle entry.
                    // We should probably NOT add individual entries for bundled files.

                    const hash = calculateHash(content);
                    const manifestKey = `metadata/sessions/${cacheKey}.json`;
                    manifest[manifestKey] = {
                        hash,
                        modified: Date.now()
                    };

                    cache.dirty = false;
                    // Keep content in memory in case we add more to it in next batch
                    cache.content = fullBundle;
                }
            }
        };

        // Migrate files in batches
        const BATCH_SIZE = 50;
        for (let i = 0; i < filesToMigrate.length; i += BATCH_SIZE) {
            const batch = filesToMigrate.slice(i, i + BATCH_SIZE);

            await Promise.all(batch.map(async (file) => {
                try {
                    // Calculate paths and sanitize double slashes
                    let relativePath = file.path.substring(mongoPath.length + 1);
                    relativePath = relativePath.replace(/^[\/\\]+/, ""); // Remove leading slashes

                    // Skip invalid paths (undefined, empty, or just whitespace)
                    if (!relativePath || !relativePath.trim() || relativePath.includes("undefined")) {
                        // Mark as done so we don't retry
                        migrationState.migrated[file.path] = true;
                        return;
                    }

                    const parts = relativePath.split("/");
                    const groupName = parts[0];
                    const isBundled = bundledGroups.has(groupName);

                    // Read from MongoDB
                    const content = await storage.readFile(file.path);

                    if (!content || !content.trim()) {
                        console.warn(`[Personal] Skipping empty file: ${file.path}`);
                        migrationState.migrated[file.path] = true;
                        return;
                    }

                    if (isBundled) {
                        if (!bundleCache[groupName]) {
                            bundleCache[groupName] = { content: {}, dirty: false };
                        }
                        // Parse content to store as object in bundle
                        try {
                            const data = JSON.parse(content);
                            const bundleKey = relativePath.substring(groupName.length + 1).replace(/^[\/\\]+/, "");
                            bundleCache[groupName].content[bundleKey] = data;
                            bundleCache[groupName].dirty = true;
                            individualFilesToRemove.add(`metadata/sessions/${relativePath}`);
                        } catch (e) {
                            console.warn(`[Personal] Skipping corrupted JSON file: ${file.path}`);
                            // Intentionally continue to mark as migrated so we don't loop forever
                        }
                    } else {
                        // Split groups: organize by year into {group}/{year}.json
                        const year = parts[1];

                        if (!year) {
                            console.warn(`[Personal] Skipping file without year: ${file.path}`);
                            migrationState.migrated[file.path] = true;
                            return;
                        }

                        const yearBundleKey = `${groupName}/${year}`;
                        if (!bundleCache[yearBundleKey]) {
                            bundleCache[yearBundleKey] = { content: {}, dirty: false };
                        }

                        try {
                            const data = JSON.parse(content);
                            const sessionKey = parts.slice(2).join("/");
                            bundleCache[yearBundleKey].content[sessionKey] = data;
                            bundleCache[yearBundleKey].dirty = true;
                            individualFilesToRemove.add(`metadata/sessions/${relativePath}`);
                        } catch (e) {
                            console.warn(`[Personal] Skipping corrupted JSON for year bundle: ${file.path}`);
                        }
                    }

                    // Mark as migrated
                    migrationState.migrated[file.path] = true;
                    migratedCount++;

                } catch (err) {
                    console.error(`[Personal] Error migrating ${file.path}:`, err);
                    addSyncLog(`[Personal] Failed: ${file.path}`, "error");
                }
            }));

            // Save progress after each batch
            await flushBundles();
            await storage.writeFile(migrationPath, JSON.stringify(migrationState, null, 2));
            await storage.writeFile(localManifestPath, JSON.stringify(manifest, null, 2));
            addSyncLog(`[Personal] Progress: ${done + migratedCount}/${total} files`, "info");
            SyncActiveStore.update(s => {
                s.personalSyncProgress = {
                    processed: done + migratedCount,
                    total: total
                };
            });
        }

        // Final save
        await flushBundles();

        // Clean up individual file entries from manifest (they're now in bundles)
        for (const fileKey of individualFilesToRemove) {
            delete manifest[fileKey];
        }
        if (individualFilesToRemove.size > 0) {
            console.log(`[Personal] Cleaned up ${individualFilesToRemove.size} individual file entries from manifest`);
        }

        await storage.writeFile(migrationPath, JSON.stringify(migrationState, null, 2));
        await storage.writeFile(localManifestPath, JSON.stringify(manifest, null, 2));

        // Check if complete
        const remaining = migrationState.files.filter(f => !migrationState.migrated[f.path]).length;
        if (remaining === 0) {
            migrationState.complete = true;
            await storage.writeFile(migrationPath, JSON.stringify(migrationState, null, 2));
            addSyncLog("[Personal] Migration complete!", "success");
        }

        const duration = ((performance.now() - start) / 1000).toFixed(1);
        addSyncLog(`[Personal] ✓ Migrated ${migratedCount} files in ${duration}s (${done + migratedCount}/${total} total)`, "success");

        return { migrated: (individualFilesToRemove.size > 0 || migratedCount > 0), fileCount: migratedCount, manifest, deletedKeys };

    } catch (err) {
        console.error("[Personal] Migration error:", err);
        addSyncLog(`[Personal] Migration failed: ${err.message}`, "error");
        return { migrated: false, fileCount: 0, error: err };
    }
}
