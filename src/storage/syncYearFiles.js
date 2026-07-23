import { logger as structuredLogger } from "@util/api/logger";
import { makePath } from "@util/data/path";

const DB_NAME = "systemconcepts-sync-years";
const STORE_NAME = "files";
const DB_VERSION = 1;
const OPFS_ROOT = "sync-years";
const LEGACY_IDB_TIMEOUT_MS = 3_000;

/** Paths like /sync/american/2026.json or /sync/american/2026.json.tmp */
const SYNC_YEAR_FILE_RE = /^\/sync\/([^/]+)\/(\d{4}\.json(?:\.tmp)?)$/;

let dbPromise = null;

function withLegacyIdbTimeout(operation, work) {
	let timeoutId;
	return Promise.race([
		work(),
		new Promise((_, reject) => {
			timeoutId = setTimeout(
				() =>
					reject(
						new Error(`Legacy year-file IndexedDB ${operation} timed out`),
					),
				LEGACY_IDB_TIMEOUT_MS,
			);
		}),
	]).finally(() => clearTimeout(timeoutId));
}

async function tryLegacyIdb(operation, work, fallback) {
	try {
		return await withLegacyIdbTimeout(operation, work);
	} catch (err) {
		structuredLogger.warn(
			`[Sync] Legacy year-file IndexedDB ${operation} unavailable; continuing without it`,
			err,
		);
		return fallback;
	}
}

export function isSyncYearFilePath(path) {
	return SYNC_YEAR_FILE_RE.test(makePath(path));
}

function parseSyncYearPath(path) {
	const key = makePath(path);
	const match = key.match(SYNC_YEAR_FILE_RE);
	if (!match) return null;
	return { key, group: match[1], fileName: match[2] };
}

function opfsAvailable() {
	return (
		typeof navigator !== "undefined" &&
		navigator.storage &&
		typeof navigator.storage.getDirectory === "function"
	);
}

async function getOpfsGroupDir(group, create) {
	const root = await navigator.storage.getDirectory();
	const yearsRoot = await root.getDirectoryHandle(OPFS_ROOT, { create });
	return yearsRoot.getDirectoryHandle(group, { create });
}

async function opfsWrite(path, content) {
	const parsed = parseSyncYearPath(path);
	if (!parsed) throw new Error(`Not a sync year file path: ${path}`);
	const dir = await getOpfsGroupDir(parsed.group, true);
	const handle = await dir.getFileHandle(parsed.fileName, { create: true });
	const writable = await handle.createWritable();
	try {
		await writable.write(
			typeof content === "string" ? content : String(content ?? ""),
		);
	} finally {
		await writable.close();
	}
}

async function opfsRead(path) {
	const parsed = parseSyncYearPath(path);
	if (!parsed) return null;
	try {
		const dir = await getOpfsGroupDir(parsed.group, false);
		const handle = await dir.getFileHandle(parsed.fileName);
		const file = await handle.getFile();
		return await file.text();
	} catch (err) {
		if (err?.name === "NotFoundError" || err?.code === "ENOENT") return null;
		throw err;
	}
}

async function opfsExists(path) {
	const parsed = parseSyncYearPath(path);
	if (!parsed) return false;
	try {
		const dir = await getOpfsGroupDir(parsed.group, false);
		await dir.getFileHandle(parsed.fileName);
		return true;
	} catch {
		return false;
	}
}

async function opfsDelete(path) {
	const parsed = parseSyncYearPath(path);
	if (!parsed) return;
	try {
		const dir = await getOpfsGroupDir(parsed.group, false);
		await dir.removeEntry(parsed.fileName);
	} catch (err) {
		if (err?.name === "NotFoundError") return;
		throw err;
	}
}

async function opfsRename(from, to) {
	const fromParsed = parseSyncYearPath(from);
	const toParsed = parseSyncYearPath(to);
	if (!fromParsed || !toParsed) {
		throw new Error(`Invalid sync year rename: ${from} → ${to}`);
	}
	const content = await opfsRead(from);
	if (content == null) {
		const err = new Error(`ENOENT: ${fromParsed.key}`);
		err.code = "ENOENT";
		throw err;
	}
	await opfsWrite(to, content);
	await opfsDelete(from);
}

async function opfsListYearFilesInDir(dirPath) {
	const dir = makePath(dirPath).replace(/\/$/, "");
	const match = dir.match(/^\/sync\/([^/]+)$/);
	if (!match) return [];
	const group = match[1];
	try {
		const groupDir = await getOpfsGroupDir(group, false);
		const names = [];
		for await (const [name, handle] of groupDir.entries()) {
			if (handle.kind === "file" && /^\d{4}\.json$/.test(name)) {
				names.push(name);
			}
		}
		return names;
	} catch {
		return [];
	}
}

function openDb() {
	if (typeof indexedDB === "undefined") {
		return Promise.reject(new Error("IndexedDB unavailable"));
	}
	if (!dbPromise) {
		dbPromise = new Promise((resolve, reject) => {
			let settled = false;
			const fail = (err) => {
				if (settled) return;
				settled = true;
				dbPromise = null;
				reject(err);
			};
			const succeed = (db) => {
				if (settled) return;
				settled = true;
				db.onclose = () => {
					dbPromise = null;
				};
				resolve(db);
			};
			const request = indexedDB.open(DB_NAME, DB_VERSION);
			request.onerror = () =>
				fail(request.error || new Error("IDB open failed"));
			request.onblocked = () =>
				fail(new Error("IndexedDB open blocked for sync year files"));
			request.onupgradeneeded = () => {
				const db = request.result;
				if (!db.objectStoreNames.contains(STORE_NAME)) {
					db.createObjectStore(STORE_NAME);
				}
			};
			request.onsuccess = () => succeed(request.result);
		});
	}
	return dbPromise;
}

function requestToPromise(request) {
	return new Promise((resolve, reject) => {
		request.onsuccess = () => resolve(request.result);
		request.onerror = () =>
			reject(request.error || new Error("IDB request failed"));
	});
}

/** Resolve when the request succeeds — do not wait for tx.oncomplete (can stall). */
function runRequest(mode, work) {
	return openDb().then(
		(db) =>
			new Promise((resolve, reject) => {
				let settled = false;
				const finish = (err, value) => {
					if (settled) return;
					settled = true;
					if (err) reject(err);
					else resolve(value);
				};
				try {
					const tx = db.transaction(STORE_NAME, mode);
					const store = tx.objectStore(STORE_NAME);
					tx.onabort = () =>
						finish(tx.error || new Error("IDB transaction aborted"));
					tx.onerror = () =>
						finish(tx.error || new Error("IDB transaction failed"));
					Promise.resolve(work(store)).then(
						(value) => finish(null, value),
						(err) => finish(err),
					);
				} catch (err) {
					finish(err);
				}
			}),
	);
}

async function idbWrite(path, content) {
	const key = makePath(path);
	const value = typeof content === "string" ? content : String(content ?? "");
	await runRequest("readwrite", (store) =>
		requestToPromise(store.put(value, key)),
	);
}

async function idbRead(path) {
	const key = makePath(path);
	const result = await runRequest("readonly", (store) =>
		requestToPromise(store.get(key)),
	);
	return typeof result === "string" ? result : (result ?? null);
}

async function idbExists(path) {
	const key = makePath(path);
	// Prefer get() over getKey() for broader browser support.
	const result = await runRequest("readonly", (store) =>
		requestToPromise(store.get(key)),
	);
	return result !== undefined && result !== null;
}

async function idbDelete(path) {
	const key = makePath(path);
	await runRequest("readwrite", (store) => requestToPromise(store.delete(key)));
}

async function idbRename(from, to) {
	const content = await idbRead(from);
	if (content == null) {
		const err = new Error(`ENOENT: ${makePath(from)}`);
		err.code = "ENOENT";
		throw err;
	}
	await idbWrite(to, content);
	await idbDelete(from);
}

async function idbListYearFilesInDir(dirPath) {
	const dir = makePath(dirPath).replace(/\/$/, "");
	const prefix = `${dir}/`;
	const keys = await runRequest("readonly", (store) =>
		requestToPromise(store.getAllKeys()),
	);
	return (keys || [])
		.map(String)
		.filter((key) => key.startsWith(prefix) && isSyncYearFilePath(key))
		.map((key) => key.slice(prefix.length))
		.filter((name) => /^\d{4}\.json$/.test(name));
}

/**
 * Backend used for the last write (for sync logs / diagnostics).
 * @type {"opfs" | "idb" | null}
 */
export let lastYearFileBackend = null;

export async function idbWriteSyncYearFile(path, content) {
	const parsed = parseSyncYearPath(path);
	if (!parsed) throw new Error(`Not a sync year file path: ${path}`);
	if (opfsAvailable()) {
		await opfsWrite(parsed.key, content);
		lastYearFileBackend = "opfs";
		return;
	}
	await idbWrite(parsed.key, content);
	lastYearFileBackend = "idb";
}

export async function idbReadSyncYearFile(path) {
	const parsed = parseSyncYearPath(path);
	if (!parsed) return null;
	if (opfsAvailable()) {
		const fromOpfs = await opfsRead(parsed.key);
		if (fromOpfs != null) return fromOpfs;
	}
	return tryLegacyIdb("read", () => idbRead(parsed.key), null);
}

export async function idbDeleteSyncYearFile(path) {
	const parsed = parseSyncYearPath(path);
	if (!parsed) return;
	if (opfsAvailable()) {
		await opfsDelete(parsed.key);
	}
	await tryLegacyIdb("delete", () => idbDelete(parsed.key), undefined);
}

export async function idbExistsSyncYearFile(path) {
	const parsed = parseSyncYearPath(path);
	if (!parsed) return false;
	if (opfsAvailable() && (await opfsExists(parsed.key))) return true;
	return tryLegacyIdb("exists", () => idbExists(parsed.key), false);
}

export async function idbRenameSyncYearFile(from, to) {
	const fromParsed = parseSyncYearPath(from);
	const toParsed = parseSyncYearPath(to);
	if (!fromParsed || !toParsed) {
		throw new Error(`Invalid sync year rename: ${from} → ${to}`);
	}
	if (opfsAvailable()) {
		await opfsRename(fromParsed.key, toParsed.key);
		lastYearFileBackend = "opfs";
		return;
	}
	await idbRename(fromParsed.key, toParsed.key);
	lastYearFileBackend = "idb";
}

export async function idbListSyncYearFilesInDir(dirPath) {
	const names = new Set();
	if (opfsAvailable()) {
		for (const name of await opfsListYearFilesInDir(dirPath)) {
			names.add(name);
		}
	}
	for (const name of await tryLegacyIdb(
		"list",
		() => idbListYearFilesInDir(dirPath),
		[],
	)) {
		names.add(name);
	}
	return [...names].sort();
}

export async function clearSyncYearFilesDb() {
	dbPromise = null;
	if (opfsAvailable()) {
		try {
			const root = await navigator.storage.getDirectory();
			await root.removeEntry(OPFS_ROOT, { recursive: true });
		} catch {
			/* ignore */
		}
	}
	if (typeof indexedDB === "undefined") return;
	await new Promise((resolve, reject) => {
		const req = indexedDB.deleteDatabase(DB_NAME);
		req.onsuccess = () => resolve();
		req.onerror = () => reject(req.error);
		req.onblocked = () => resolve();
	});
}
