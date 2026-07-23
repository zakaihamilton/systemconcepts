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

const WRITE_TIMEOUT_MS = 45_000;
const MANIFEST_TIMEOUT_MS = 15_000;

/** Let React paint status updates before heavy sync work blocks the main thread. */
export function yieldToMain() {
	return new Promise((resolve) => setTimeout(resolve, 0));
}

function withTimeout(promise, ms, message) {
	let timeoutId;
	const timeout = new Promise((_, reject) => {
		timeoutId = setTimeout(() => reject(new Error(message)), ms);
	});
	return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
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

function slimFileRef(file) {
	if (!file || typeof file !== "object") return file;
	const slim = { name: file.name, path: file.path };
	if (file.type) slim.type = file.type;
	return slim;
}

/**
 * Drop listing-stat noise from media refs before persisting. Full wasabi/aws
 * listing objects inflate year files enough to hang IndexedDB writes.
 */
export function slimSessionForPersist(session) {
	if (!session || typeof session !== "object") return session;
	const slim = { ...session };
	if (slim.audio) slim.audio = slimFileRef(slim.audio);
	if (slim.video) slim.video = slimFileRef(slim.video);
	if (slim.image) slim.image = slimFileRef(slim.image);
	if (slim.subtitles && typeof slim.subtitles === "object") {
		slim.subtitles = slimFileRef(slim.subtitles);
	}
	if (slim.summary && typeof slim.summary === "object") {
		slim.summary = slimFileRef(slim.summary);
	}
	if (slim.resolutions && typeof slim.resolutions === "object") {
		slim.resolutions = Object.fromEntries(
			Object.entries(slim.resolutions).map(([key, value]) => [
				key,
				slimFileRef(value),
			]),
		);
	}
	return slim;
}

function normalizeYearSessions(sessions) {
	return sessions
		.slice()
		.sort((a, b) => a.id.localeCompare(b.id))
		.map((s) => slimSessionForPersist({ name: s.id, ...s }));
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
 * Persist a split-group year file.
 *
 * Avoids re-reading the existing year JSON (already loaded earlier in the
 * update pipeline) — that second IndexedDB read + equality stringify was
 * freezing Update Sessions on large groups after "Saving sessions…".
 */
export async function updateYearSync(
	groupName,
	year,
	sessions,
	previousSessions = null,
) {
	if (!sessions || sessions.length === 0) {
		return { ...EMPTY_YEAR_SYNC_RESULT };
	}
	const localPath = makePath(LOCAL_SYNC_PATH, groupName, `${year}.json`);
	const unlock = await lockMutex({ id: localPath });
	try {
		await yieldToMain();
		const normalizedSessions = normalizeYearSessions(sessions);

		const previous = Array.isArray(previousSessions) ? previousSessions : [];
		const existingIds = new Set(previous.map((s) => s.name || s.id));
		const newSessions = normalizedSessions.filter(
			(s) => !existingIds.has(s.name || s.id),
		);
		const newCount = newSessions.length;

		await yieldToMain();
		const sessionsJson = JSON.stringify(normalizedSessions);
		const counter = Date.now();
		const jsonString = `{"version":${counter},"group":${JSON.stringify(
			groupName,
		)},"year":${JSON.stringify(year)},"sessions":${sessionsJson},"counter":${counter}}`;

		await yieldToMain();
		await withTimeout(
			writeCompressedFile(localPath, jsonString),
			WRITE_TIMEOUT_MS,
			`Timed out writing year sync ${groupName}/${year}`,
		);

		try {
			await withTimeout(
				updateLocalManifestForSyncFile(localPath, jsonString),
				MANIFEST_TIMEOUT_MS,
				`Timed out updating manifest for ${groupName}/${year}`,
			);
		} catch (err) {
			structuredLogger.warn(
				`[Sync] Failed to update manifest for ${localPath}`,
				err,
			);
		}

		return { counter, newCount, newSessions };
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

		const updatedGroups = new Set(newSessions.map((s) => s.group));
		allSessions = allSessions.filter((s) => !updatedGroups.has(s.group));
		allSessions.push(...newSessions.map(slimSessionForPersist));

		const bundleData = {
			version: 1,
			date: Date.now(),
			sessions: allSessions,
		};
		await yieldToMain();
		const jsonString = JSON.stringify(bundleData);
		await withTimeout(
			writeCompressedFile(bundlePath, jsonString),
			WRITE_TIMEOUT_MS,
			"Timed out writing bundle.json",
		);

		try {
			await withTimeout(
				updateLocalManifestForSyncFile(bundlePath, jsonString),
				MANIFEST_TIMEOUT_MS,
				"Timed out updating manifest for bundle.json",
			);
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
