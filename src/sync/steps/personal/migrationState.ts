import { readGroups } from "@sync/groups";
import { addSyncLog } from "@sync/logs";
import { logger as structuredLogger } from "@util/api/logger";
import storage from "@util/storage/storage";
import { FILES_MANIFEST } from "../../constants";

export const MIGRATION_FILE = "migration.json";
export const MONGO_SESSIONS_PATH = "personal/metadata/sessions";

export type MigrationFile = { path: string; mtimeMs: number };

export type MigrationState = {
	files: MigrationFile[];
	migrated: Record<string, boolean>;
	complete: boolean;
};

export type GroupClassification = {
	bundledGroups: Set<any>;
	mergedGroups: Set<any>;
	allGroups: Set<any>;
};

const SKIP_COMPLETE_RESULT = {
	migrated: false,
	fileCount: 0,
	manifest: null,
	deletedKeys: [] as any[],
};

export async function safeWriteMigration(
	migrationPath: string,
	data: MigrationState,
	_stage?: string,
) {
	const content = JSON.stringify(data, null, 2);
	// Direct write for performance, skipping double-verify overhead
	await storage.writeFile(migrationPath, content);
}

export async function loadOrResetMigrationState(
	migrationPath: string,
	remotePathSet: Set<string>,
	localPath: any,
	canUpload: boolean,
): Promise<{
	migrationState: MigrationState;
	earlyReturn?: typeof SKIP_COMPLETE_RESULT;
}> {
	let migrationState: MigrationState = {
		files: [],
		migrated: {},
		complete: false,
	};

	if (!(await storage.exists(migrationPath))) {
		return { migrationState };
	}

	try {
		const content = await storage.readFile(migrationPath);
		structuredLogger.debug(
			`[Personal] Migration file exists, size: ${content?.length || 0} bytes`,
		);
		if (!content || !content.trim()) {
			throw new Error("Empty migration file");
		}
		migrationState = JSON.parse(content) as MigrationState;

		if (migrationState.complete) {
			// Check for zombie state: Migration thinks it's done, but remote is empty.
			const remoteHasJson = Array.from(remotePathSet).some((k) =>
				k.endsWith(".json"),
			);

			if (!remoteHasJson && canUpload) {
				const localListing = await storage.getRecursiveList(localPath);
				const localHasJson = localListing.some(
					(l: any) =>
						l.name.endsWith(".json") &&
						l.name !== MIGRATION_FILE &&
						l.name !== FILES_MANIFEST,
				);

				if (!localHasJson) {
					structuredLogger.debug(
						"[Personal] Migration marked complete but local and remote are empty. Forcing re-migration.",
					);
					migrationState.complete = false;
					migrationState.migrated = {};
				} else {
					structuredLogger.debug(
						"[Personal] Migration already complete locally, waiting for upload.",
					);
					return { migrationState, earlyReturn: SKIP_COMPLETE_RESULT };
				}
			} else if (!remoteHasJson && !canUpload) {
				structuredLogger.debug(
					"[Personal] Migration marked complete locally. Skipping remote check (read-only mode)",
				);
				return { migrationState, earlyReturn: SKIP_COMPLETE_RESULT };
			} else {
				structuredLogger.debug(
					"[Personal] Migration already complete (verified by remote), skipping",
				);
				return { migrationState, earlyReturn: SKIP_COMPLETE_RESULT };
			}
		}

		addSyncLog(
			`[Personal] Resuming migration: ${Object.keys(migrationState.migrated).length}/${migrationState.files.length} done`,
			"info",
		);
	} catch (err: any) {
		structuredLogger.error("[Personal] Error loading migration state:", err);
		addSyncLog(
			`[Personal] Migration state file corrupted or empty, starting fresh: ${err instanceof Error ? err.message : String(err)}`,
			"info",
		);
		try {
			await storage.deleteFile(migrationPath);
		} catch {}
	}

	return { migrationState };
}

export async function scanMongoFiles(
	migrationPath: string,
	migrationState: MigrationState,
): Promise<{ migrated: false; fileCount: 0 } | null> {
	if (migrationState.files.length > 0) {
		return null;
	}

	addSyncLog("[Personal] Scanning MongoDB for files to migrate...", "info");

	if (!(await storage.exists(MONGO_SESSIONS_PATH))) {
		addSyncLog("[Personal] No MongoDB personal files found", "info");
		migrationState.complete = true;
		await storage.writeFile(
			migrationPath,
			JSON.stringify(migrationState, null, 4),
		);
		return { migrated: false, fileCount: 0 };
	}

	const listing = await storage.getRecursiveList(MONGO_SESSIONS_PATH);
	const files = listing.filter(
		(item: any) =>
			item.type !== "dir" &&
			item.name &&
			item.name.trim() &&
			!item.name.endsWith(".DS_Store"),
	);

	if (files.length === 0) {
		addSyncLog("[Personal] No files found in MongoDB", "info");
		migrationState.complete = true;
		await safeWriteMigration(migrationPath, migrationState, "empty_mongo");
		return { migrated: false, fileCount: 0 };
	}

	migrationState.files = files.map((f: any) => ({
		path: f.path,
		mtimeMs: f.mtimeMs || Date.now(),
	}));

	await safeWriteMigration(migrationPath, migrationState, "cache_files");
	addSyncLog(`[Personal] Cached ${files.length} files for migration`, "info");
	return null;
}

export async function loadGroupClassification(): Promise<GroupClassification> {
	const bundledGroups = new Set<any>();
	const mergedGroups = new Set<any>();
	const allGroups = new Set<any>();

	try {
		const { groups } = await readGroups();
		if (groups) {
			groups.forEach((g: any) => {
				allGroups.add(g.name);
				if (g.bundled) {
					bundledGroups.add(g.name);
				} else if (g.merged) {
					mergedGroups.add(g.name);
				}
			});
		}
	} catch (err: any) {
		structuredLogger.error(
			"[Personal] Error loading groups for bundling check:",
			err,
		);
	}

	return { bundledGroups, mergedGroups, allGroups };
}

export async function linkRemoteFiles(
	migrationState: MigrationState,
	remotePathSet: Set<string>,
	groups: GroupClassification,
	migrationPath: string,
) {
	const { bundledGroups, mergedGroups, allGroups } = groups;
	let autoMigratedCount = 0;
	let hasNewSkippedFiles = false;

	for (const file of migrationState.files) {
		if (migrationState.migrated[file.path]) continue;

		let relativePath = file.path.substring(MONGO_SESSIONS_PATH.length + 1);
		relativePath = relativePath.replace(/^[\/\\]+/, "");

		if (!relativePath || !relativePath.trim()) continue;

		const parts = relativePath.split("/");
		const groupName = parts[0];

		if (!allGroups.has(groupName)) {
			migrationState.migrated[file.path] = true;
			continue;
		}

		const isBundled = bundledGroups.has(groupName);
		const isMerged = mergedGroups.has(groupName);

		let existsRemote = false;
		if (isBundled) {
			existsRemote = remotePathSet.has("bundle.json");
		} else if (isMerged) {
			existsRemote = remotePathSet.has(`${groupName}.json`);
		} else {
			existsRemote = remotePathSet.has(`${relativePath}`);
		}

		if (existsRemote) {
			migrationState.migrated[file.path] = true;
			hasNewSkippedFiles = true;
			autoMigratedCount++;
		}
	}

	if (hasNewSkippedFiles) {
		addSyncLog(
			`[Personal] Linked ${autoMigratedCount} files to existing remote data`,
			"info",
		);
		await safeWriteMigration(migrationPath, migrationState, "linked_remote");
	}
}
