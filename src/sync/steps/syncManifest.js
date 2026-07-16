import { logger as structuredLogger } from "@util/api/logger";
import { makePath } from "@util/data/path";
import storage from "@util/storage/storage";
import { readCompressedFile, writeCompressedFile } from "../bundle";
import {
	FILES_MANIFEST,
	FILES_MANIFEST_GZ,
	SYNC_BASE_PATH,
} from "../constants";
import { addSyncLog } from "../logs";
import { readFileIfExists } from "../storageReads";

/**
 * Normalize a file path to ensure it starts with a leading slash
 */
function normalizePath(path) {
	if (!path) return path;
	return path.startsWith("/") ? path : "/" + path;
}

/**
 * Normalize and deduplicate manifest entries
 * Ensures all paths have leading slashes and removes duplicates (keeping highest version)
 */
function normalizeManifest(manifest) {
	if (!manifest || !Array.isArray(manifest)) return [];

	const pathMap = new Map();

	for (const entry of manifest) {
		if (!entry.path || entry.path === "loadedFromManifest") {
			if (entry.path === "loadedFromManifest") {
				structuredLogger.debug(
					"[Sync] Filtering internal flag from manifest entries",
				);
			} else {
				structuredLogger.warn(
					"[Sync] Skipping invalid manifest entry (missing path):",
					JSON.stringify(entry),
				);
			}
			continue;
		}
		const normalizedPath = normalizePath(entry.path);
		const normalizedEntry = { ...entry, path: normalizedPath };
		const version = parseInt(entry.version) || 0;

		if (pathMap.has(normalizedPath)) {
			// Keep the entry with higher version
			const existing = pathMap.get(normalizedPath);
			const existingVersion = parseInt(existing.version) || 0;
			if (version > existingVersion) {
				pathMap.set(normalizedPath, normalizedEntry);
			}
		} else {
			pathMap.set(normalizedPath, normalizedEntry);
		}
	}

	return Array.from(pathMap.values());
}

/**
 * Step 3: Download the files.json or generate it from listing
 */
export async function syncManifest(
	remotePath = SYNC_BASE_PATH,
	isLocked = false,
	skipScan = false,
) {
	const start = performance.now();
	addSyncLog("Step 3: Syncing manifest...", "info");

	const remoteManifestPathGz = makePath(remotePath, FILES_MANIFEST_GZ);
	const remoteManifestPathJson = makePath(remotePath, FILES_MANIFEST);

	try {
		let remoteManifest = [];
		let loadedFromManifest = false;
		let authoritative = false;

		// 1. Try files.gz
		try {
			const rawManifest = await readCompressedFile(remoteManifestPathGz, {
				strict: true,
			});
			if (Array.isArray(rawManifest)) {
				authoritative = true;
				// structuredLogger.debug(`[Sync] Raw Manifest Sample (first 5 of ${rawManifest.length}):`, JSON.stringify(rawManifest.slice(0, 5)));
				remoteManifest = normalizeManifest(rawManifest);
				const deduped = rawManifest.length - remoteManifest.length;
				structuredLogger.debug(
					`[Sync] Found ${remoteManifestPathGz}, count: ${rawManifest.length}${deduped > 0 ? ` (removed ${deduped} duplicates)` : ""}`,
				);
				if (deduped === rawManifest.length && rawManifest.length > 0) {
					structuredLogger.error(
						"[Sync] CRITICAL: All items removed during normalization!",
					);
				}

				// If we cleaned up duplicates, save the cleaned manifest back
				if (deduped > 0) {
					if (!isLocked) {
						try {
							await writeCompressedFile(remoteManifestPathGz, remoteManifest);
							structuredLogger.debug(
								`[Sync] Saved cleaned manifest to ${remoteManifestPathGz}`,
							);
						} catch (e) {
							structuredLogger.warn(
								`[Sync] Failed to save cleaned manifest: ${e.message}`,
							);
						}
					} else {
						structuredLogger.debug(
							`[Sync] Skipping manifest cleanup save (locked)`,
						);
					}
				}

				loadedFromManifest = true;
			} else if (rawManifest !== null) {
				throw new Error(
					`Invalid remote sync manifest at ${remoteManifestPathGz}`,
				);
			}
		} catch (err) {
			structuredLogger.warn(
				`[Sync] Failed to read compressed manifest ${remoteManifestPathGz}:`,
				err.message || err,
			);
			throw err;
		}

		// 2. Try files.json
		if (!loadedFromManifest && remoteManifest.length === 0) {
			const content = await readFileIfExists(storage, remoteManifestPathJson);
			if (content) {
				try {
					const rawManifest = JSON.parse(content);
					if (!Array.isArray(rawManifest)) {
						throw new Error("Remote manifest must be an array");
					}
					remoteManifest = normalizeManifest(rawManifest);
					const deduped = rawManifest.length - remoteManifest.length;
					structuredLogger.debug(
						`[Sync] Found ${remoteManifestPathJson}, count: ${rawManifest.length}${deduped > 0 ? ` (removed ${deduped} duplicates)` : ""}`,
					);
					loadedFromManifest = true;
					authoritative = true;
				} catch (e) {
					structuredLogger.error("[Sync] Error parsing remote manifest", e);
					throw new Error(
						`Invalid remote sync manifest at ${remoteManifestPathJson}`,
						{
							cause: e,
						},
					);
				}
			}
		}

		// 3. Fallback: Generate from listing if still empty
		if (!loadedFromManifest && remoteManifest.length === 0) {
			if (skipScan) {
				structuredLogger.debug(
					`[Sync] Manifest empty or missing, skipping scan for ${remotePath} (skipScan: true)`,
				);
			} else {
				structuredLogger.debug(
					`[Sync] Manifest empty or missing, checking ${remotePath} for files...`,
				);
				const listing = await storage.getRecursiveList(remotePath, {
					strict: true,
				});
				structuredLogger.debug(
					`[Sync] Recursive listing found ${listing.length} items in ${remotePath}`,
				);

				if (listing.length > 0) {
					structuredLogger.debug(
						"[Sync] Listing Sample:",
						JSON.stringify(listing.slice(0, 5)),
					);
				}

				remoteManifest = listing
					.filter((item) => {
						const isDir =
							item.type === "dir" ||
							item.stat?.type === "dir" ||
							item.name.endsWith("/");
						const isManifest =
							item.name === FILES_MANIFEST || item.name === FILES_MANIFEST_GZ;
						const isDSStore = item.name.endsWith(".DS_Store");
						const isTrash = item.path.includes(".sync-trash");
						const include = !isDir && !isManifest && !isDSStore && !isTrash;
						if (!include && !isManifest && !isDSStore) {
							structuredLogger.debug(
								`[Sync] Filtering out: ${item.name} (isDir=${isDir})`,
							);
						}
						return include;
					})
					.map((item) => {
						const prefix = makePath(remotePath);
						let relPath = item.path.substring(prefix.length);
						if (relPath.startsWith("/")) {
							relPath = relPath.slice(1);
						}
						if (relPath.endsWith(".gz")) {
							relPath = relPath.slice(0, -3);
						}
						if (!relPath.startsWith("/")) {
							relPath = "/" + relPath;
						}
						return {
							path: relPath,
							size: item.size || 0,
							hash: null, // Hash unknown
							version: Math.max(2, item.mtimeMs || 1).toString(),
						};
					});
				structuredLogger.debug(
					`[Sync] After filtering, remoteManifest has ${remoteManifest.length} files`,
				);
				authoritative = true;
			}
		}

		const duration = ((performance.now() - start) / 1000).toFixed(1);
		addSyncLog(
			`✓ Synced manifest (${remoteManifest.length} files) in ${duration}s`,
			"info",
		);

		// Attach flag to indicate if manifest was loaded from file vs generated/empty
		// This is crucial for preventing mass deletion when remote is missing/corrupted
		remoteManifest.loadedFromManifest = loadedFromManifest;
		remoteManifest.authoritative = authoritative;

		// If we generated the manifest (and it's not empty), save it to speed up next time
		if (!loadedFromManifest && remoteManifest.length > 0) {
			if (!isLocked) {
				try {
					await writeCompressedFile(remoteManifestPathGz, remoteManifest);
					addSyncLog(
						`Saved generated manifest (${remoteManifest.length} files)`,
						"info",
					);
				} catch (e) {
					structuredLogger.warn(
						`[Sync] Failed to save generated manifest: ${e.message}`,
					);
				}
			} else {
				addSyncLog(`Generated manifest (not saved - locked)`, "info");
			}
		}

		return remoteManifest;
	} catch (err) {
		structuredLogger.error("[Sync] Step 3 error:", err);
		throw err;
	}
}
