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

const WRITE_TIMEOUT_MS = 20_000;
const LOCK_TIMEOUT_MS = 10_000;
const STRINGIFY_CHUNK = 25;
// Yield briefly between large IndexedDB operations so the UI can paint.
const FS_SETTLE_MS = process.env.NODE_ENV === "test" ? 0 : 50;

/** Let React paint status updates before heavy sync work blocks the main thread. */
export function yieldToMain() {
	return new Promise((resolve) => setTimeout(resolve, 0));
}

function withTimeout(promise: any, ms: any, message: any) {
	let timeoutId: any;
	const timeout = new Promise((_, reject) => {
		timeoutId = setTimeout(() => reject(new Error(message)), ms);
	});
	return Promise.race([promise, timeout]).finally(() =>
		clearTimeout(timeoutId),
	);
}

async function settleLocalFs(ms = FS_SETTLE_MS) {
	const wait = process.env.NODE_ENV === "test" ? 0 : ms;
	await new Promise((resolve) => setTimeout(resolve, wait));
}

export async function getListing(path: any) {
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

function slimFileRef(file: any) {
	if (!file || typeof file !== "object") return file;
	const slim: Record<string, any> = { name: file.name, path: file.path };
	if (file.type) slim.type = file.type;
	return slim;
}

/**
 * Drop listing-stat noise and inline summary bodies before persisting.
 * summaryText is reloaded on demand via summary.path (see Session view /
 * loadParagraphs). Keeping it in year files freezes stringify/IndexedDB on
 * large groups.
 */
export function slimSessionForPersist(session: any) {
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

function normalizeYearSessions(sessions: any) {
	return sessions
		.slice()
		.sort((a: any, b: any) => a.id.localeCompare(b.id))
		.map((s: any) => slimSessionForPersist({ name: s.id, ...s }));
}

/**
 * Stringify a large array in chunks, yielding between chunks so UI timers and
 * write timeouts can run. A single JSON.stringify of 500+ sessions with media
 * metadata blocks the main thread long enough that "Saving sessions…" never
 * advances.
 */
export async function stringifyJsonArrayChunked(items: any, onProgress: any) {
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

async function updateLocalManifestForSyncFile(localPath: any, content: any) {
	const info = await getFileInfo(content);
	const manifestPath = makePath(LOCAL_SYNC_PATH, FILES_MANIFEST);
	const relPath = localPath.substring(makePath(LOCAL_SYNC_PATH).length);
	const entry = {
		path: relPath.startsWith("/") ? relPath : "/" + relPath,
		hash: info.hash,
		size: info.size,
		version: Date.now().toString(),
	};
	await settleLocalFs();
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
 * Write a year JSON file without deleting the live file first.
 * Writes to a temp path, then renames over the destination so a failed update
 * never leaves the group without sessions for the next sync.
 */
async function writeLocalYearFile(
	localPath: any,
	jsonString: any,
	logPrefix: any,
) {
	const tempPath = `${localPath}.tmp`;
	const parentPath = localPath.substring(0, localPath.lastIndexOf("/"));

	addSyncLog(`${logPrefix} Settling local storage…`, "verbose");
	await settleLocalFs(1500);
	addSyncLog(`${logPrefix} Ensuring folder ${parentPath}…`, "verbose");
	await withTimeout(
		storage.createFolderPath(parentPath, true),
		WRITE_TIMEOUT_MS,
		`Timed out creating folder ${parentPath}`,
	);

	// Clean up a leftover temp from a previous interrupted save (not the live file).
	try {
		if (await storage.exists(tempPath)) {
			await storage.deleteFile(tempPath);
			await settleLocalFs();
		}
	} catch (err: any) {
		structuredLogger.warn(`[Sync] Could not clear temp file ${tempPath}`, err);
	}

	let lastError = null;
	for (let attempt = 1; attempt <= 3; attempt++) {
		try {
			addSyncLog(
				`${logPrefix} Writing temp file (attempt ${attempt}/3)…`,
				"info",
			);
			await settleLocalFs(attempt === 1 ? 500 : 1000 * attempt);
			await withTimeout(
				storage.writeFile(tempPath, jsonString),
				WRITE_TIMEOUT_MS,
				`Timed out writing temp ${tempPath} (attempt ${attempt})`,
			);
			addSyncLog(`${logPrefix} Promoting temp file…`, "info");
			await settleLocalFs();
			await withTimeout(
				storage.rename(tempPath, localPath),
				WRITE_TIMEOUT_MS,
				`Timed out renaming ${tempPath} → ${localPath}`,
			);
			return;
		} catch (err: any) {
			lastError = err;
			addSyncLog(
				`${logPrefix} Write attempt ${attempt} failed: ${err.message || err}`,
				attempt === 3 ? "error" : "warning",
			);
			try {
				if (await storage.exists(tempPath)) await storage.deleteFile(tempPath);
			} catch {
				// The live file remains intact; temp cleanup is best effort.
			}
			if (attempt < 3) await settleLocalFs(2000 * attempt);
		}
	}
	throw lastError || new Error(`Failed to write ${localPath}`);
}

/**
 * Persist a split-group year file without re-reading disk or blocking the UI
 * on a single giant JSON.stringify / IndexedDB write.
 */
export async function updateYearSync(
	groupName: any,
	year: any,
	sessions: any,
	previousSessions = null,
) {
	if (!sessions || sessions.length === 0) {
		return { ...EMPTY_YEAR_SYNC_RESULT };
	}
	const localPath = makePath(LOCAL_SYNC_PATH, groupName, `${year}.json`);
	const logPrefix = `[${groupName}/${year}]`;
	let unlock = null;
	try {
		addSyncLog(`${logPrefix} Saving ${sessions.length} session(s)…`, "info");
		await yieldToMain();

		unlock = await withTimeout(
			lockMutex({ id: localPath }),
			LOCK_TIMEOUT_MS,
			`Timed out waiting to save ${groupName}/${year}`,
		);

		const normalizedSessions = normalizeYearSessions(sessions);
		await yieldToMain();

		const previous: any[] = Array.isArray(previousSessions)
			? previousSessions
			: [];
		const existingIds = new Set(previous.map((s) => s.name || s.id));
		const newSessions = normalizedSessions.filter(
			(s: any) => !existingIds.has(s.name || s.id),
		);
		const newCount = newSessions.length;

		addSyncLog(
			`${logPrefix} Serializing ${normalizedSessions.length} session(s)…`,
			"verbose",
		);
		const sessionsJson = await stringifyJsonArrayChunked(
			normalizedSessions,
			(done: any, total: any) => {
				if (done === total || done % 100 === 0) {
					addSyncLog(`${logPrefix} Serialized ${done}/${total}…`, "verbose");
				}
			},
		);
		const counter = Date.now();
		const jsonString = `{"version":${counter},"group":${JSON.stringify(
			groupName,
		)},"year":${JSON.stringify(year)},"sessions":${sessionsJson},"counter":${counter}}`;

		addSyncLog(
			`${logPrefix} Prepared ${(jsonString.length / 1024).toFixed(0)}KB payload…`,
			"info",
		);
		await writeLocalYearFile(localPath, jsonString, logPrefix);

		void updateLocalManifestForSyncFile(localPath, jsonString).catch((err) => {
			structuredLogger.warn(
				`[Sync] Failed to update manifest for ${localPath}`,
				err,
			);
			addSyncLog(
				`${logPrefix} Manifest update failed: ${err.message || err}`,
				"warning",
			);
		});

		addSyncLog(`${logPrefix} ✓ Saved (${newCount} new).`, "success");
		return { counter, newCount, newSessions };
	} catch (err: any) {
		structuredLogger.error(
			`[Sync] Error updating year sync ${groupName}/${year}:`,
			err,
		);
		addSyncLog(`${logPrefix} Save failed: ${err.message || err}`, "error");
		return { ...EMPTY_YEAR_SYNC_RESULT };
	} finally {
		if (typeof unlock === "function") unlock();
	}
}

export async function updateBundleFile(newSessions: any) {
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
		} catch (err: any) {
			structuredLogger.error(
				"[Sync] Failed to read existing bundle for update",
				err,
			);
			throw err;
		}

		const updatedGroups = new Set(newSessions.map((s: any) => s.group));
		allSessions = allSessions.filter((s: any) => !updatedGroups.has(s.group));
		allSessions.push(...newSessions.map(slimSessionForPersist));

		const bundleData = {
			version: 1,
			date: Date.now(),
			sessions: allSessions,
		};
		const jsonString = JSON.stringify(bundleData);
		await settleLocalFs();
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
