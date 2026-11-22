import { addSyncLog } from "@sync/logs";
import { makePath } from "@util/data/path";
import storage from "@util/storage/storage";
import {
	type GroupClassification,
	type MigrationState,
	MONGO_SESSIONS_PATH,
	safeWriteMigration,
} from "./migrationState";

export type ManifestEntry = {
	path: string;
	version?: number;
	[key: string]: any;
};

export async function loadManifestMap(
	remoteManifest: any,
	localManifestPath: string,
): Promise<Map<string, ManifestEntry>> {
	const manifestMap = new Map<string, ManifestEntry>(
		(remoteManifest || []).map((entry: any) => [entry.path, entry]),
	);

	if (await storage.exists(localManifestPath)) {
		try {
			const content = await storage.readFile(localManifestPath);
			const localManifest = JSON.parse(content) as ManifestEntry[];
			if (Array.isArray(localManifest)) {
				localManifest.forEach((entry) => manifestMap.set(entry.path, entry));
			}
		} catch {}
	}

	return manifestMap;
}

export function createDeleteTracker(
	manifestMap: Map<string, ManifestEntry>,
	deletedKeysSet: Set<any>,
) {
	return (key: any) => {
		if (manifestMap.has(key)) {
			manifestMap.delete(key);
			deletedKeysSet.add(key);
		}
	};
}

export async function repairDoubleSlashEntries(
	migrationState: MigrationState,
	manifestMap: Map<string, ManifestEntry>,
	markAsDeleted: (key: any) => void,
	groups: GroupClassification,
	migrationPath: string,
) {
	if (!migrationState.files || migrationState.files.length === 0) {
		return;
	}

	const { bundledGroups, allGroups } = groups;
	let repairCount = 0;

	for (const file of migrationState.files) {
		const rawRelativePath = file.path.substring(MONGO_SESSIONS_PATH.length + 1);
		if (!rawRelativePath.startsWith("/")) continue;

		const badManifestKey = `metadata/sessions/${rawRelativePath}`;
		if (!manifestMap.has(badManifestKey)) continue;

		markAsDeleted(badManifestKey);

		const cleanRelativePath = rawRelativePath.replace(/^[\/\\]+/, "");
		const cleanManifestKey = makePath(cleanRelativePath);
		const groupName = cleanRelativePath.split("/")[0];

		if (!allGroups.has(groupName)) {
			continue;
		}

		const isBundled = bundledGroups.has(groupName);
		const cleanEntryExists = isBundled
			? manifestMap.has(makePath(`${groupName}.json`))
			: manifestMap.has(cleanManifestKey);

		if (!cleanEntryExists && migrationState.migrated[file.path]) {
			migrationState.migrated[file.path] = false;
			migrationState.complete = false;
			repairCount++;
		}
	}

	if (repairCount > 0) {
		addSyncLog(
			`[Personal] Found ${repairCount} files with double-slash paths. Queued for repair.`,
			"warning",
		);
		await safeWriteMigration(migrationPath, migrationState, "repair_paths");
	}
}

export function cleanupMigratedManifestEntries(
	migrationState: MigrationState,
	markAsDeleted: (key: any) => void,
) {
	for (const file of migrationState.files) {
		if (migrationState.migrated[file.path]) {
			const relativePath = file.path
				.substring(MONGO_SESSIONS_PATH.length + 1)
				.replace(/^[\/\\]+/, "");
			markAsDeleted(makePath(relativePath));
		}
	}
}
