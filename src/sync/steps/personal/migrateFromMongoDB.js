import storage from "@util/storage";
import { makePath } from "@util/path";
import { addSyncLog } from "@sync/logs";
import { calculateHash } from "@sync/hash";
import { readGroups } from "@sync/groups";

import { SyncActiveStore } from "@sync/syncState";
import { FILES_MANIFEST } from "../../constants";

const MIGRATION_FILE = "migration.json";

/**
 * Step 3.5: Migrate personal files from MongoDB to AWS S3
 * Uses local migration.json to track progress and allow resumable migration
 * Files are copied to local storage immediately so user sees progress
 */
export async function migrateFromMongoDB(userid, remoteManifest, localPath, canUpload = true) {
    const start = performance.now();
    const migrationPath = makePath(localPath, MIGRATION_FILE);
    const localManifestPath = makePath(localPath, FILES_MANIFEST);

    // Create a Set for efficient O(1) lookups of remote paths
    const remotePathSet = new Set(Array.isArray(remoteManifest) ? remoteManifest.map(f => f.path) : []);
    addSyncLog(`Migration check: Remote manifest has ${remotePathSet.size} files (Array check: ${Array.isArray(remoteManifest)})`, "verbose");

    // Check if migration has already occurred by looking at remote manifest
    // If the user has files in the personal folder, we assume migration is done.
    const hasRemoteFiles = Array.from(remotePathSet).some(key =>
        key.endsWith(".json")
    );

    if (hasRemoteFiles) {
        console.log("[Personal] Remote personal files exist, but proceeding to scan in case of broken migration");
        // return { migrated: false, fileCount: 0, manifest: null, deletedKeys: [] };
    }

    const safeWriteMigration = async (data) => {
        const content = JSON.stringify(data, null, 2);
        // Direct write for performance, skipping double-verify overhead
        await storage.writeFile(migrationPath, content);
    };

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
                    // Check for zombie state: Migration thinks it's done, but remote is empty.
                    // This implies the files were migrated locally, but then deleted before upload.
                    const remoteHasJson = Array.from(remotePathSet).some(k => k.endsWith(".json"));

                    if (!remoteHasJson && canUpload) {
                        // Double check local storage. If we have local files, it's not a zombie state, 
                        // it's just a "waiting to upload" state.
                        const localListing = await storage.getRecursiveList(localPath);
                        const localHasJson = localListing.some(l =>
                            l.name.endsWith(".json") &&
                            l.name !== MIGRATION_FILE &&
                            l.name !== FILES_MANIFEST
                        );

                        if (!localHasJson) {
                            console.log("[Personal] Migration marked complete but local and remote are empty. Forcing re-migration.");
                            migrationState.complete = false;
                            migrationState.migrated = {};
                            // Fall through to normal logic
                        } else {
                            console.log("[Personal] Migration already complete locally, waiting for upload.");
                            return { migrated: false, fileCount: 0, manifest: null, deletedKeys: [] };
                        }
                    } else if (!remoteHasJson && !canUpload) {
                        console.log("[Personal] Migration marked complete locally. Skipping remote check (read-only mode)");
                        return { migrated: false, fileCount: 0, manifest: null, deletedKeys: [] };
                    } else {
                        console.log("[Personal] Migration already complete (verified by remote), skipping");
                        return { migrated: false, fileCount: 0, manifest: null, deletedKeys: [] };
                    }
                }

                addSyncLog(`[Personal] Resuming migration: ${Object.keys(migrationState.migrated).length}/${migrationState.files.length} done`, "info");
            } catch (err) {
                console.error("[Personal] Error loading migration state:", err);
                addSyncLog(`[Personal] Migration state file corrupted or empty, starting fresh: ${err.message}`, "info");
                // Explicitly delete the corrupted file to prevent loops
                try { await storage.deleteFile(migrationPath); } catch { }
                // State remains at default (initialized above)
            }
        }

        // If no files cached, scan MongoDB and cache them
        if (migrationState.files.length === 0) {
            addSyncLog("[Personal] Scanning MongoDB for files to migrate...", "info");



            if (!(await storage.exists(mongoPath))) {
                addSyncLog("[Personal] No MongoDB personal files found", "info");
                migrationState.complete = true;
                await storage.writeFile(migrationPath, JSON.stringify(migrationState, null, 4));
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
                await safeWriteMigration(migrationState, "empty_mongo");
                return { migrated: false, fileCount: 0 };
            }

            // Cache file list
            migrationState.files = files.map(f => ({
                path: f.path,
                mtimeMs: f.mtimeMs || Date.now()
            }));

            await safeWriteMigration(migrationState, "cache_files");
            addSyncLog(`[Personal] Cached ${files.length} files for migration`, "info");
        }

        // Check usage of remoteManifest to skip already processed files
        // This handles the "Fresh Sync / Reset" scenario
        // We do this check before filtering filesToMigrate
        let autoMigratedCount = 0;


        // Helper to get expected manifest key
        const _getManifestKey = (filePath) => {
            let relativePath = filePath.substring(mongoPath.length + 1);
            relativePath = relativePath.replace(/^[\/\\]+/, "");
            return `${relativePath}`;
        };

        // Helper to check bundling status
        // We need to know if a group is bundled to check for the BUNDLE file in manifest instead of individual file
        // We already loaded groups later, but we need them now.
        // Let's hoist the group loading logic up.



        // Load groups to check for bundled status
        let bundledGroups = new Set();
        let mergedGroups = new Set();
        let allGroups = new Set();
        try {
            const { groups } = await readGroups();
            if (groups) {
                groups.forEach(g => {
                    allGroups.add(g.name);
                    if (g.bundled) {
                        bundledGroups.add(g.name);
                    } else if (g.merged) {
                        mergedGroups.add(g.name);
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

            // Skip if group doesn't exist
            if (!allGroups.has(groupName)) {
                migrationState.migrated[file.path] = true;
                continue;
            }

            const isBundled = bundledGroups.has(groupName);
            const isMerged = mergedGroups.has(groupName);

            let existsRemote = false;

            if (isBundled) {
                // Check if the common bundle exists in manifest
                const bundleKey = "bundle.json";
                if (remotePathSet.has(bundleKey)) {
                    existsRemote = true;
                }
            } else if (isMerged) {
                // Check if the group bundle exists in manifest
                const bundleKey = `${groupName}.json`;
                if (remotePathSet.has(bundleKey)) {
                    existsRemote = true;
                }
            } else {
                const manifestKey = `${relativePath}`;
                if (remotePathSet.has(manifestKey)) {
                    existsRemote = true;
                }
            }

            if (existsRemote) {
                // If remote exists, we assume it is the source of truth and skip local migration
                migrationState.migrated[file.path] = true;
                hasNewSkippedFiles = true;
                autoMigratedCount++;
            }
        }

        if (hasNewSkippedFiles) {
            addSyncLog(`[Personal] Linked ${autoMigratedCount} files to existing remote data`, "info");
            await safeWriteMigration(migrationState, "linked_remote");
        }

        // NOW filter for work to do
        const filesToMigrate = migrationState.files.filter(f => !migrationState.migrated[f.path]);

        if (filesToMigrate.length === 0) {
            addSyncLog("[Personal] All files migrated!", "success");
            migrationState.complete = true;
            await safeWriteMigration(migrationState, "complete_skipped");
            // Still return manifest in case we need to upload cleaned entries
            return { migrated: false, fileCount: 0, manifest: null, deletedKeys: [] };
        }

        const total = migrationState.files.length;
        const done = total - filesToMigrate.length;
        addSyncLog(`[Personal] Migrating ${filesToMigrate.length} remaining files (${done}/${total} done)`, "info");

        // Create a map of current manifest entries for updates
        const manifestMap = new Map((remoteManifest || []).map(entry => [entry.path, entry]));

        // Load current local manifest to update it
        if (await storage.exists(localManifestPath)) {
            try {
                const content = await storage.readFile(localManifestPath);
                const localManifest = JSON.parse(content);
                if (Array.isArray(localManifest)) {
                    localManifest.forEach(entry => manifestMap.set(entry.path, entry));
                }
            } catch { }
        }

        const deletedKeysSet = new Set();

        // Helper to mark key as deleted
        const markAsDeleted = (key) => {
            if (manifestMap.has(key)) {
                manifestMap.delete(key);
                deletedKeysSet.add(key);
            }
        };

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

                    if (manifestMap.has(badManifestKey)) {
                        // Found a bad entry - blacklist
                        markAsDeleted(badManifestKey);

                        // Check if we ALREADY have the clean entry (e.g. from previous partial run)
                        // If so, we don't need to re-migrate, just clean the manifest
                        const cleanRelativePath = rawRelativePath.replace(/^[\/\\]+/, "");
                        const cleanManifestKey = `${cleanRelativePath}`;

                        const parts = cleanRelativePath.split("/");
                        const groupName = parts[0];

                        // Skip if group doesn't exist
                        if (!allGroups.has(groupName)) {
                            continue;
                        }

                        const isBundled = bundledGroups.has(groupName);

                        let cleanEntryExists = false;
                        if (isBundled) {
                            const bundleKey = `${groupName}.json`;
                            if (manifestMap.has(bundleKey)) {
                                cleanEntryExists = true;
                            }
                        } else {
                            if (manifestMap.has(cleanManifestKey)) {
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
                await safeWriteMigration(migrationState, "repair_paths");
            }
        }

        // Cleanup Step: Remove individual manifest entries for files that were already migrated
        // This handles the "Zombie Manifest Entry" issue where a previous run crashed before cleanup
        for (const file of migrationState.files) {
            if (migrationState.migrated[file.path]) {
                const relativePath = file.path.substring(mongoPath.length + 1).replace(/^[\/\\]+/, "");
                const manifestKey = `${relativePath}`;
                markAsDeleted(manifestKey);
            }
        }

        let migratedCount = 0;


        // bundledGroups already loaded at top of function

        // Bundle cache: { [groupName or group/year]: { content: { [relativePath]: data }, dirty: false } }
        const bundleCache = {};


        // Helper to flush bundles
        const flushBundles = async () => {
            for (const [cacheKey, cache] of Object.entries(bundleCache)) {
                if (cache.dirty) {
                    const bundlePath = makePath(localPath, `${cacheKey}.json`);

                    // Optimization: Only read existing file if we haven't loaded it yet
                    // This prevents reading the file repeatedly in subsequent batches
                    if (!cache.loaded && await storage.exists(bundlePath)) {
                        try {
                            const existing = JSON.parse(await storage.readFile(bundlePath));
                            cache.content = { ...existing, ...cache.content };
                        } catch { }
                    }
                    cache.loaded = true;

                    const content = JSON.stringify(cache.content, null, 4);

                    await storage.createFolderPath(bundlePath);
                    await storage.writeFile(bundlePath, content);

                    const hash = await calculateHash(content);

                    const manifestKey = `${cacheKey}.json`;
                    const oldEntry = manifestMap.get(manifestKey);
                    const version = oldEntry ? (oldEntry.version || 1) + 1 : 1;
                    manifestMap.set(manifestKey, {
                        path: manifestKey,
                        hash,
                        modified: Date.now(),
                        version
                    });

                    cache.dirty = false;
                }
            }
        };

        // Sort files to migrate by path to ensure bundle locality
        // This makes sure we process all files for a group/year together, minimizing bundle I/O
        filesToMigrate.sort((a, b) => a.path.localeCompare(b.path));

        // Migrate files in batches
        const BATCH_SIZE = 500;
        for (let i = 0; i < filesToMigrate.length; i += BATCH_SIZE) {
            const batch = filesToMigrate.slice(i, i + BATCH_SIZE);

            // Optimization: Read all files in the batch at once
            // This prevents "Failed" errors caused by too many concurrent HTTP requests
            let batchContents = null;
            try {
                const batchPaths = batch.map(f => {
                    // Strip "personal/" prefix to get path relative to device
                    // file.path is like /personal/metadata/sessions/...
                    const parts = f.path.split("/").filter(Boolean);
                    return parts.slice(1).join("/");
                });
                batchContents = await storage.readFiles("personal", batchPaths);
            } catch (err) {
                console.error("[Personal] Error batch reading files:", err);
            }

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

                    // Skip if group doesn't exist
                    if (!allGroups.has(groupName)) {
                        migrationState.migrated[file.path] = true;
                        return;
                    }

                    const isBundled = bundledGroups.has(groupName);
                    const isMerged = mergedGroups.has(groupName);

                    if (!batchContents) {
                        throw new Error("Batch read failed");
                    }

                    // Read from MongoDB using batch cache
                    const fileParts = file.path.split("/").filter(Boolean);
                    const lookupKey = "/" + fileParts.slice(1).join("/");
                    const content = batchContents[lookupKey];

                    if (!content || !content.trim()) {
                        console.warn(`[Personal] Skipping empty file: ${file.path}`);
                        migrationState.migrated[file.path] = true;
                        return;
                    }

                    if (isBundled || isMerged) {
                        // Bundled goes to "bundle.json", Merged goes to "{group}.json"
                        // Key for Bundled: "group/file.json" (relativePath is suitable)
                        // Key for Merged: "file.json" (relativePath without group)

                        const cacheKey = isBundled ? "bundle" : groupName;
                        if (!bundleCache[cacheKey]) {
                            bundleCache[cacheKey] = { content: {}, dirty: false };
                        }

                        try {
                            const data = JSON.parse(content);
                            let bundleKey = "";
                            if (isBundled) {
                                bundleKey = relativePath; // e.g. "independent/session.json"
                            } else {
                                // Merged: strip group name
                                bundleKey = relativePath.substring(groupName.length + 1).replace(/^[\/\\]+/, "");
                            }

                            bundleCache[cacheKey].content[bundleKey] = data;
                            bundleCache[cacheKey].dirty = true;
                            markAsDeleted(`metadata/sessions/${relativePath}`);
                        } catch {
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
                            markAsDeleted(`metadata/sessions/${relativePath}`);
                        } catch {
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
            await safeWriteMigration(migrationState, "batch_progress");
            await storage.writeFile(localManifestPath, JSON.stringify(Array.from(manifestMap.values()), null, 4));
            addSyncLog(`[Personal] Progress: ${done + migratedCount}/${total} files`, "info");
            SyncActiveStore.update(s => {
                s.personalSyncProgress = {
                    processed: done + migratedCount,
                    total: total
                };
            });
        }

        // Final manifest as array
        const finalManifest = Array.from(manifestMap.values());

        // Final save
        await flushBundles();

        await safeWriteMigration(migrationState, "final_save");
        await storage.writeFile(localManifestPath, JSON.stringify(finalManifest, null, 4));


        // Check if complete
        const remaining = migrationState.files.filter(f => !migrationState.migrated[f.path]).length;
        if (remaining === 0) {
            migrationState.complete = true;
            await safeWriteMigration(migrationState, "complete");
            addSyncLog("[Personal] Migration complete!", "success");
        }

        const duration = ((performance.now() - start) / 1000).toFixed(1);
        addSyncLog(`[Personal] ✓ Migrated ${migratedCount} files in ${duration}s (${done + migratedCount}/${total} total)`, "success");

        // Convert set to array
        const deletedKeys = Array.from(deletedKeysSet);

        return { migrated: (deletedKeysSet.size > 0 || migratedCount > 0), fileCount: migratedCount, manifest: finalManifest, deletedKeys };

    } catch (err) {
        console.error("[Personal] Migration error:", err);
        addSyncLog(`[Personal] Migration failed: ${err.message}`, "error");
        return { migrated: false, fileCount: 0, error: err };
    }
}
