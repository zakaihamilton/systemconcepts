import { calculateHash } from "@sync/hash";
import { addSyncLog } from "@sync/logs";
import { logger as structuredLogger } from "@util/api/logger";
import { makePath } from "@util/data/path";
import storage from "@util/storage/storage";
import type { ManifestEntry } from "./manifestRepair";
import {
	type GroupClassification,
	type MigrationFile,
	type MigrationState,
	MONGO_SESSIONS_PATH,
} from "./migrationState";

export type BundleCache = {
	content: Record<string, any>;
	dirty: boolean;
	loaded?: boolean;
};

export async function flushBundles(
	bundleCache: Record<string, BundleCache>,
	localPath: any,
	manifestMap: Map<string, ManifestEntry>,
) {
	for (const [cacheKey, cache] of Object.entries(bundleCache)) {
		if (!cache.dirty) continue;

		const bundlePath = makePath(localPath, `${cacheKey}.json`);

		// Optimization: Only read existing file if we haven't loaded it yet
		if (!cache.loaded && (await storage.exists(bundlePath))) {
			try {
				const existing = JSON.parse(await storage.readFile(bundlePath));
				cache.content = { ...existing, ...cache.content };
			} catch {}
		}
		cache.loaded = true;

		const content = JSON.stringify(cache.content, null, 4);

		await storage.createFolderPath(bundlePath);
		await storage.writeFile(bundlePath, content);

		const hash = await calculateHash(content);

		const manifestKey = makePath(`${cacheKey}.json`);
		const oldEntry = manifestMap.get(manifestKey);
		const version = oldEntry ? (oldEntry.version || 1) + 1 : 1;
		manifestMap.set(manifestKey, {
			path: manifestKey,
			hash,
			modified: Date.now(),
			version,
		});

		cache.dirty = false;
	}
}

export async function processMigrationBatch(
	batch: MigrationFile[],
	migrationState: MigrationState,
	groups: GroupClassification,
	bundleCache: Record<string, BundleCache>,
	markAsDeleted: (key: any) => void,
): Promise<number> {
	const { bundledGroups, mergedGroups, allGroups } = groups;
	let batchMigratedCount = 0;

	let batchContents: Record<string, string> | null = null;
	try {
		const batchPaths = batch.map((f) => {
			const parts = f.path.split("/").filter(Boolean);
			return parts.slice(1).join("/");
		});
		batchContents = await storage.readFiles("personal", batchPaths);
	} catch (err: any) {
		structuredLogger.error("[Personal] Error batch reading files:", err);
	}

	await Promise.all(
		batch.map(async (file) => {
			try {
				let relativePath = file.path.substring(MONGO_SESSIONS_PATH.length + 1);
				relativePath = relativePath.replace(/^[\/\\]+/, "");

				if (
					!relativePath ||
					!relativePath.trim() ||
					relativePath.includes("undefined")
				) {
					migrationState.migrated[file.path] = true;
					return;
				}

				const parts = relativePath.split("/");
				const groupName = parts[0];

				if (!allGroups.has(groupName)) {
					migrationState.migrated[file.path] = true;
					return;
				}

				const isBundled = bundledGroups.has(groupName);
				const isMerged = mergedGroups.has(groupName);

				if (!batchContents) {
					throw new Error("Batch read failed");
				}

				const fileParts = file.path.split("/").filter(Boolean);
				const lookupKey = "/" + fileParts.slice(1).join("/");
				const content = batchContents[lookupKey];

				if (!content || !content.trim()) {
					structuredLogger.warn(`[Personal] Skipping empty file: ${file.path}`);
					migrationState.migrated[file.path] = true;
					return;
				}

				if (isBundled || isMerged) {
					const cacheKey = isBundled ? "bundle" : groupName;
					if (!bundleCache[cacheKey]) {
						bundleCache[cacheKey] = { content: {}, dirty: false };
					}

					try {
						const data = JSON.parse(content);
						const bundleKey = isBundled
							? relativePath
							: relativePath
									.substring(groupName.length + 1)
									.replace(/^[\/\\]+/, "");

						bundleCache[cacheKey].content[bundleKey] = data;
						bundleCache[cacheKey].dirty = true;
						markAsDeleted(makePath(`metadata/sessions/${relativePath}`));
					} catch {
						structuredLogger.warn(
							`[Personal] Skipping corrupted JSON file: ${file.path}`,
						);
					}
				} else {
					const year = parts[1];
					if (!year) {
						structuredLogger.warn(
							`[Personal] Skipping file without year: ${file.path}`,
						);
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
						markAsDeleted(makePath(`metadata/sessions/${relativePath}`));
					} catch {
						structuredLogger.warn(
							`[Personal] Skipping corrupted JSON for year bundle: ${file.path}`,
						);
					}
				}

				migrationState.migrated[file.path] = true;
				batchMigratedCount++;
			} catch (err: any) {
				structuredLogger.error(`[Personal] Error migrating ${file.path}:`, err);
				addSyncLog(`[Personal] Failed: ${file.path}`, "error");
			}
		}),
	);

	return batchMigratedCount;
}
