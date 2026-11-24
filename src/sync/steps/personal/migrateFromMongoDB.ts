import { addSyncLog } from "@sync/logs";
import { SyncActiveStore } from "@sync/syncState";
import { logger as structuredLogger } from "@util/api/logger";
import { makePath } from "@util/data/path";
import storage from "@util/storage/storage";
import { FILES_MANIFEST } from "../../constants";
import {
	type BundleCache,
	flushBundles,
	processMigrationBatch,
} from "./bundleWriter";
import {
	cleanupMigratedManifestEntries,
	createDeleteTracker,
	loadManifestMap,
	repairDoubleSlashEntries,
} from "./manifestRepair";
import {
	linkRemoteFiles,
	loadGroupClassification,
	loadOrResetMigrationState,
	MIGRATION_FILE,
	safeWriteMigration,
	scanMongoFiles,
} from "./migrationState";

export type MigrateFromMongoDBResult = {
	migrated: boolean;
	fileCount: number;
	manifest?: any;
	deletedKeys?: any[];
	error?: any;
};

/**
 * Step 3.5: Migrate personal files from MongoDB to AWS S3
 * Uses local migration.json to track progress and allow resumable migration
 * Files are copied to local storage immediately so user sees progress
 */
export async function migrateFromMongoDB(
	_userid: any,
	remoteManifest: any,
	localPath: any,
	canUpload = true,
): Promise<MigrateFromMongoDBResult> {
	const start = performance.now();
	const migrationPath = makePath(localPath, MIGRATION_FILE);
	const localManifestPath = makePath(localPath, FILES_MANIFEST);

	const remotePathSet = new Set<string>(
		Array.isArray(remoteManifest) ? remoteManifest.map((f) => f.path) : [],
	);
	addSyncLog(
		`Migration check: Remote manifest has ${remotePathSet.size} files (Array check: ${Array.isArray(remoteManifest)})`,
		"verbose",
	);

	const hasMigrationFile =
		remotePathSet.has("/migration.json") || remotePathSet.has("migration.json");

	if (hasMigrationFile) {
		structuredLogger.debug(
			"[Personal] Remote migration.json exists, skipping migration.",
		);
		return { migrated: false, fileCount: 0, manifest: null, deletedKeys: [] };
	}

	const hasRemoteFiles = Array.from(remotePathSet).some(
		(key) => key.endsWith(".json") && !key.endsWith("migration.json"),
	);

	if (hasRemoteFiles) {
		structuredLogger.debug(
			"[Personal] Remote personal files exist (but no migration.json), proceeding to scan in case of broken migration",
		);
	}

	try {
		const { migrationState, earlyReturn } = await loadOrResetMigrationState(
			migrationPath,
			remotePathSet,
			localPath,
			canUpload,
		);
		if (earlyReturn) {
			return earlyReturn;
		}

		const scanResult = await scanMongoFiles(migrationPath, migrationState);
		if (scanResult) {
			return scanResult;
		}

		const groups = await loadGroupClassification();

		await linkRemoteFiles(migrationState, remotePathSet, groups, migrationPath);

		const filesToMigrate = migrationState.files.filter(
			(f) => !migrationState.migrated[f.path],
		);

		if (filesToMigrate.length === 0) {
			addSyncLog("[Personal] All files migrated!", "success");
			migrationState.complete = true;
			await safeWriteMigration(
				migrationPath,
				migrationState,
				"complete_skipped",
			);
			return { migrated: false, fileCount: 0, manifest: null, deletedKeys: [] };
		}

		const total = migrationState.files.length;
		const done = total - filesToMigrate.length;
		addSyncLog(
			`[Personal] Migrating ${filesToMigrate.length} remaining files (${done}/${total} done)`,
			"info",
		);

		const manifestMap = await loadManifestMap(
			remoteManifest,
			localManifestPath,
		);
		const deletedKeysSet = new Set<any>();
		const markAsDeleted = createDeleteTracker(manifestMap, deletedKeysSet);

		await repairDoubleSlashEntries(
			migrationState,
			manifestMap,
			markAsDeleted,
			groups,
			migrationPath,
		);
		cleanupMigratedManifestEntries(migrationState, markAsDeleted);

		let migratedCount = 0;
		const bundleCache: Record<string, BundleCache> = {};

		// Sort files to migrate by path to ensure bundle locality
		filesToMigrate.sort((a, b) => a.path.localeCompare(b.path));

		const BATCH_SIZE = 500;
		for (let i = 0; i < filesToMigrate.length; i += BATCH_SIZE) {
			const batch = filesToMigrate.slice(i, i + BATCH_SIZE);
			migratedCount += await processMigrationBatch(
				batch,
				migrationState,
				groups,
				bundleCache,
				markAsDeleted,
			);

			await flushBundles(bundleCache, localPath, manifestMap);
			await safeWriteMigration(migrationPath, migrationState, "batch_progress");
			await storage.writeFile(
				localManifestPath,
				JSON.stringify(Array.from(manifestMap.values()), null, 4),
			);
			addSyncLog(
				`[Personal] Progress: ${done + migratedCount}/${total} files`,
				"info",
			);
			SyncActiveStore.update((s) => {
				s.personalSyncProgress = {
					processed: done + migratedCount,
					total: total,
				};
			});
		}

		const finalManifest = Array.from(manifestMap.values());
		await flushBundles(bundleCache, localPath, manifestMap);
		await safeWriteMigration(migrationPath, migrationState, "final_save");
		await storage.writeFile(
			localManifestPath,
			JSON.stringify(finalManifest, null, 4),
		);

		const remaining = migrationState.files.filter(
			(f) => !migrationState.migrated[f.path],
		).length;
		if (remaining === 0) {
			migrationState.complete = true;
			await safeWriteMigration(migrationPath, migrationState, "complete");
			addSyncLog("[Personal] Migration complete!", "success");
		}

		const duration = ((performance.now() - start) / 1000).toFixed(1);
		addSyncLog(
			`[Personal] ✓ Migrated ${migratedCount} files in ${duration}s (${done + migratedCount}/${total} total)`,
			"success",
		);

		return {
			migrated: deletedKeysSet.size > 0 || migratedCount > 0,
			fileCount: migratedCount,
			manifest: finalManifest,
			deletedKeys: Array.from(deletedKeysSet),
		};
	} catch (err: any) {
		structuredLogger.error("[Personal] Migration error:", err);
		addSyncLog(
			`[Personal] Migration failed: ${err instanceof Error ? err.message : String(err)}`,
			"error",
		);
		return { migrated: false, fileCount: 0, error: err };
	}
}
