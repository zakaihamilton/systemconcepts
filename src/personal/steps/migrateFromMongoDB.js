import storage from "@util/storage";
import { makePath } from "@util/path";
import { addSyncLog } from "@sync/logs";
import { calculateHash } from "@sync/hash";
import { LOCAL_PERSONAL_PATH, PERSONAL_MANIFEST } from "../constants";

const MIGRATION_FILE = "migration.json";

/**
 * Step 3.5: Migrate personal files from MongoDB to AWS S3
 * Uses local migration.json to track progress and allow resumable migration
 * Files are copied to local storage immediately so user sees progress
 */
export async function migrateFromMongoDB(userid, remoteManifest, basePath) {
    const start = performance.now();
    const migrationPath = makePath(LOCAL_PERSONAL_PATH, MIGRATION_FILE);
    const localManifestPath = makePath(LOCAL_PERSONAL_PATH, PERSONAL_MANIFEST);

    try {
        // Load or create migration state
        let migrationState = { files: [], migrated: {}, complete: false };

        if (await storage.exists(migrationPath)) {
            try {
                const content = await storage.readFile(migrationPath);
                if (!content || !content.trim()) {
                    throw new Error("Empty migration file");
                }
                migrationState = JSON.parse(content);

                // If migration is complete, skip
                if (migrationState.complete) {
                    return { migrated: false, fileCount: 0 };
                }

                addSyncLog(`[Personal] Resuming migration: ${Object.keys(migrationState.migrated).length}/${migrationState.files.length} done`, "info");
            } catch (err) {
                addSyncLog(`[Personal] Migration state file corrupted or empty, starting fresh: ${err.message}`, "warning");
                // State remains at default (initialized above)
            }
        }

        // If no files cached, scan MongoDB and cache them
        if (migrationState.files.length === 0) {
            addSyncLog("[Personal] Scanning MongoDB for files to migrate...", "info");

            const mongoPath = "personal/metadata/sessions";

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
            await storage.writeFile(migrationPath, JSON.stringify(migrationState, null, 2));

            addSyncLog(`[Personal] Cached ${files.length} files for migration`, "info");
        }

        // Find files that haven't been migrated yet
        const filesToMigrate = migrationState.files.filter(f => !migrationState.migrated[f.path]);

        if (filesToMigrate.length === 0) {
            addSyncLog("[Personal] All files migrated!", "success");
            migrationState.complete = true;
            await storage.writeFile(migrationPath, JSON.stringify(migrationState, null, 2));
            return { migrated: false, fileCount: 0 };
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

        let migratedCount = 0;
        const mongoPath = "personal/metadata/sessions";

        // Migrate files one by one, saving progress after each batch
        for (const file of filesToMigrate) {
            try {
                // Calculate paths
                const relativePath = file.path.substring(mongoPath.length + 1);

                // Skip invalid paths (undefined, empty, or just whitespace)
                if (!relativePath || !relativePath.trim() || relativePath.includes("undefined")) {
                    addSyncLog(`[Personal] Skipping invalid path: ${file.path}`, "info");
                    migrationState.migrated[file.path] = true; // Mark as done so we don't retry
                    continue;
                }

                // Read from MongoDB
                const content = await storage.readFile(file.path);

                const awsPath = makePath(basePath, "metadata/sessions", relativePath);
                const localPath = makePath(LOCAL_PERSONAL_PATH, "metadata/sessions", relativePath);

                // Create parent directories for local path
                await storage.createFolderPath(localPath);

                // Write to AWS
                await storage.writeFile(awsPath, content);

                // Write to local storage (so user sees progress immediately)
                await storage.writeFile(localPath, content);

                // Add to manifest
                const hash = calculateHash(content);
                const manifestKey = `metadata/sessions/${relativePath}`;
                manifest[manifestKey] = {
                    hash,
                    modified: file.mtimeMs
                };

                // Mark as migrated
                migrationState.migrated[file.path] = true;
                migratedCount++;

                // Save progress every 5 files
                if (migratedCount % 5 === 0) {
                    await storage.writeFile(migrationPath, JSON.stringify(migrationState, null, 2));
                    await storage.writeFile(localManifestPath, JSON.stringify(manifest, null, 2));
                    addSyncLog(`[Personal] Progress: ${done + migratedCount}/${total} files`, "info");
                }

            } catch (err) {
                console.error(`[Personal] Error migrating ${file.path}:`, err);
                addSyncLog(`[Personal] Failed: ${file.path}`, "error");
            }
        }

        // Final save
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

        return { migrated: migratedCount > 0, fileCount: migratedCount, manifest };

    } catch (err) {
        console.error("[Personal] Migration error:", err);
        addSyncLog(`[Personal] Migration failed: ${err.message}`, "error");
        return { migrated: false, fileCount: 0, error: err };
    }
}
