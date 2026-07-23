import { writeCompressedFile } from "@sync/bundle";
import { FILES_MANIFEST, LOCAL_SYNC_PATH } from "@sync/constants";
import { getFileInfo } from "@sync/hash";
import { updateManifestEntry } from "@sync/manifest";
import { lockMutex } from "@sync/mutex";
import { logger as structuredLogger } from "@util/api/logger";
import { makePath } from "@util/data/path";
import storage from "@util/storage/storage";

const EMPTY_YEAR_SYNC_RESULT = Object.freeze({
	counter: 0,
	newCount: 0,
	newSessions: [],
});

/** Let React paint status updates before heavy sync work blocks the main thread. */
export function yieldToMain() {
	return new Promise((resolve) => setTimeout(resolve, 0));
}

export async function getListing(path) {
	structuredLogger.debug(`[getListing] Requesting listing for: ${path}`);
	let listing = await storage.getListing(path);
	structuredLogger.debug(
		`[getListing] Received listing with ${listing?.length || 0} items for: ${path}`,
	);
	if (!listing) {
		structuredLogger.warn(`[getListing] No listing returned for: ${path}`);
		return [];
	}
	return listing;
}

function normalizeYearSessions(sessions) {
	return sessions
		.slice()
		.sort((a, b) => a.id.localeCompare(b.id))
		.map((s) => ({ name: s.id, ...s }));
}

async function updateLocalManifestForSyncFile(localPath, content) {
	const info = await getFileInfo(content);
	const manifestPath = makePath(LOCAL_SYNC_PATH, FILES_MANIFEST);
	const relPath = localPath.substring(makePath(LOCAL_SYNC_PATH).length);
	const entry = {
		path: relPath.startsWith("/") ? relPath : "/" + relPath,
		hash: info.hash,
		size: info.size,
		version: Date.now().toString(),
	};
	const unlock = await lockMutex({ id: manifestPath });
	try {
		await updateManifestEntry(manifestPath, entry);
	} finally {
		unlock();
	}
}

/**
 * Persist a split-group year file. Uses compact JSON (not pretty-printed) and
 * hashes the in-memory payload so large years do not re-read multi-MB files
 * from IndexedDB after every write.
 */
export async function updateYearSync(groupName, year, sessions) {
	if (!sessions || sessions.length === 0) {
		return { ...EMPTY_YEAR_SYNC_RESULT };
	}
	const localPath = makePath(LOCAL_SYNC_PATH, groupName, `${year}.json`);
	const unlock = await lockMutex({ id: localPath });
	try {
		await yieldToMain();

		let version = 1;
		let existingObj = null;
		if (await storage.exists(localPath)) {
			try {
				const existingContent = await storage.readFile(localPath);
				existingObj = JSON.parse(existingContent);
				if (existingObj?.version) {
					version = existingObj.version + 1;
				}
			} catch {
				existingObj = null;
			}
		}

		await yieldToMain();
		const normalizedSessions = normalizeYearSessions(sessions);
		const sessionsJson = JSON.stringify(normalizedSessions);

		let newCount = 0;
		let newSessions = [];
		if (existingObj && Array.isArray(existingObj.sessions)) {
			const existingIds = new Set(
				existingObj.sessions.map((s) => s.name || s.id),
			);
			newSessions = normalizedSessions.filter(
				(s) => !existingIds.has(s.name || s.id),
			);
			newCount = newSessions.length;

			if (
				existingObj.group === groupName &&
				JSON.stringify(existingObj.sessions) === sessionsJson
			) {
				return { ...EMPTY_YEAR_SYNC_RESULT };
			}
		} else if (existingObj && !Array.isArray(existingObj.sessions)) {
			newSessions = normalizedSessions;
			newCount = normalizedSessions.length;
		} else if (!existingObj) {
			newSessions = normalizedSessions;
			newCount = normalizedSessions.length;
		}

		const data = {
			version,
			group: groupName,
			year: year,
			sessions: normalizedSessions,
			counter: Date.now(),
		};
		// Compact JSON: pretty-printing multi-hundred session years was freezing
		// Update Sessions after the UI already showed N/N sessions complete.
		const jsonString = `{"version":${data.version},"group":${JSON.stringify(
			data.group,
		)},"year":${JSON.stringify(data.year)},"sessions":${sessionsJson},"counter":${
			data.counter
		}}`;

		await yieldToMain();
		await writeCompressedFile(localPath, jsonString);

		try {
			await updateLocalManifestForSyncFile(localPath, jsonString);
		} catch (err) {
			structuredLogger.warn(
				`[Sync] Failed to update manifest for ${localPath}`,
				err,
			);
		}

		return { counter: data.counter, newCount, newSessions };
	} catch (err) {
		structuredLogger.error(
			`[Sync] Error updating year sync ${groupName}/${year}:`,
			err,
		);
		return { ...EMPTY_YEAR_SYNC_RESULT };
	} finally {
		unlock();
	}
}

export async function updateBundleFile(newSessions) {
	const bundlePath = makePath(LOCAL_SYNC_PATH, "bundle.json");
	const unlock = await lockMutex({ id: bundlePath });
	try {
		let allSessions = [];

		// 1. Read existing bundle
		try {
			if (await storage.exists(bundlePath)) {
				const content = await storage.readFile(bundlePath);
				const data = JSON.parse(content);
				if (data && Array.isArray(data.sessions)) {
					allSessions = data.sessions;
				}
			}
		} catch (err) {
			structuredLogger.error(
				"[Sync] Failed to read existing bundle for update",
				err,
			);
			throw err;
		}

		// 2. Remove old sessions for groups that we are updating
		const updatedGroups = new Set(newSessions.map((s) => s.group));
		allSessions = allSessions.filter((s) => !updatedGroups.has(s.group));

		// 3. Add new sessions
		allSessions.push(...newSessions);

		// 4. Write bundle (compact — same hang risk as year files for large bundles)
		const bundleData = {
			version: 1,
			date: Date.now(),
			sessions: allSessions,
		};
		await yieldToMain();
		const jsonString = JSON.stringify(bundleData);
		await writeCompressedFile(bundlePath, jsonString);

		try {
			await updateLocalManifestForSyncFile(bundlePath, jsonString);
		} catch (err) {
			structuredLogger.warn(
				`[Sync] Failed to update manifest for ${bundlePath}`,
				err,
			);
		}

		structuredLogger.debug(
			`[Sync] Updated bundle.json with ${newSessions.length} new sessions. Total: ${allSessions.length}`,
		);
	} finally {
		unlock();
	}
}
