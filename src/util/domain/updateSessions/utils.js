import { writeCompressedFile } from "@sync/bundle";
import { FILES_MANIFEST, LOCAL_SYNC_PATH } from "@sync/constants";
import { getFileInfo } from "@sync/hash";
import { addSyncLog } from "@sync/logs";
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

const WRITE_TIMEOUT_MS = 30_000;
const LOCK_TIMEOUT_MS = 10_000;
const STRINGIFY_CHUNK = 25;

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
 * Drop listing-stat noise and inline summary bodies before persisting.
 * summaryText is reloaded on demand via summary.path (see Session view /
 * loadParagraphs). Keeping it in year files freezes stringify/IndexedDB on
 * large groups.
 */
export function slimSessionForPersist(session) {
	if (!session || typeof session !== "object") return session;
	const slim = { ...session };
	delete slim.summaryText;
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

/**
 * Stringify a large array in chunks, yielding between chunks so UI timers and
 * write timeouts can run. A single JSON.stringify of 500+ sessions with media
 * metadata blocks the main thread long enough that "Saving sessions…" never
 * advances.
 */
export async function stringifyJsonArrayChunked(items, onProgress) {
	if (!items.length) return "[]";
	let json = "[";
	for (let i = 0; i < items.length; i++) {
		if (i > 0) json += ",";
		json += JSON.stringify(items[i]);
		if ((i + 1) % STRINGIFY_CHUNK === 0 || i + 1 === items.length) {
			onProgress?.(i + 1, items.length);
			await yieldToMain();
		}
	}
	return `${json}]`;
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
	const unlock = await withTimeout(
		lockMutex({ id: manifestPath }),
		LOCK_TIMEOUT_MS,
		`Timed out locking manifest for ${relPath}`,
	);
	try {
		await updateManifestEntry(manifestPath, entry);
	} finally {
		unlock();
	}
}

/**
 * Persist a split-group year file without re-reading disk or blocking the UI
 * on a single giant JSON.stringify / IndexedDB write.
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
	let unlock = null;
	try {
		addSyncLog(
			`[${groupName}/${year}] Saving ${sessions.length} session(s)…`,
			"info",
		);
		await yieldToMain();

		unlock = await withTimeout(
			lockMutex({ id: localPath }),
			LOCK_TIMEOUT_MS,
			`Timed out waiting to save ${groupName}/${year}`,
		);

		const normalizedSessions = normalizeYearSessions(sessions);
		await yieldToMain();

		const previous = Array.isArray(previousSessions) ? previousSessions : [];
		const existingIds = new Set(previous.map((s) => s.name || s.id));
		const newSessions = normalizedSessions.filter(
			(s) => !existingIds.has(s.name || s.id),
		);
		const newCount = newSessions.length;

		addSyncLog(
			`[${groupName}/${year}] Serializing ${normalizedSessions.length} session(s)…`,
			"verbose",
		);
		const sessionsJson = await stringifyJsonArrayChunked(
			normalizedSessions,
			(done, total) => {
				if (done === total || done % 100 === 0) {
					addSyncLog(
						`[${groupName}/${year}] Serialized ${done}/${total}…`,
						"verbose",
					);
				}
			},
		);
		const counter = Date.now();
		const jsonString = `{"version":${counter},"group":${JSON.stringify(
			groupName,
		)},"year":${JSON.stringify(year)},"sessions":${sessionsJson},"counter":${counter}}`;

		addSyncLog(
			`[${groupName}/${year}] Writing ${(jsonString.length / 1024).toFixed(0)}KB…`,
			"info",
		);
		await yieldToMain();
		await withTimeout(
			writeCompressedFile(localPath, jsonString),
			WRITE_TIMEOUT_MS,
			`Timed out writing year sync ${groupName}/${year}`,
		);

		// Manifest update must not block year completion.
		void updateLocalManifestForSyncFile(localPath, jsonString).catch((err) => {
			structuredLogger.warn(
				`[Sync] Failed to update manifest for ${localPath}`,
				err,
			);
			addSyncLog(
				`[${groupName}/${year}] Manifest update failed: ${err.message || err}`,
				"warning",
			);
		});

		addSyncLog(
			`[${groupName}/${year}] ✓ Saved (${newCount} new).`,
			"success",
		);
		return { counter, newCount, newSessions };
	} catch (err) {
		structuredLogger.error(
			`[Sync] Error updating year sync ${groupName}/${year}:`,
			err,
		);
		addSyncLog(
			`[${groupName}/${year}] Save failed: ${err.message || err}`,
			"error",
		);
		return { ...EMPTY_YEAR_SYNC_RESULT };
	} finally {
		if (typeof unlock === "function") unlock();
	}
}

export async function updateBundleFile(newSessions) {
	const bundlePath = makePath(LOCAL_SYNC_PATH, "bundle.json");
	let unlock = null;
	try {
		unlock = await withTimeout(
			lockMutex({ id: bundlePath }),
			LOCK_TIMEOUT_MS,
			"Timed out waiting to save bundle.json",
		);
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

		void updateLocalManifestForSyncFile(bundlePath, jsonString).catch((err) => {
			structuredLogger.warn(
				`[Sync] Failed to update manifest for ${bundlePath}`,
				err,
			);
		});

		structuredLogger.debug(
			`[Sync] Updated bundle.json with ${newSessions.length} new sessions. Total: ${allSessions.length}`,
		);
	} finally {
		if (typeof unlock === "function") unlock();
	}
}
