import { makePath } from "@util/data/path";

const DB_NAME = "systemconcepts-sync-years";
const STORE_NAME = "files";
const DB_VERSION = 1;

/** Paths like /sync/american/2026.json or /sync/american/2026.json.tmp */
const SYNC_YEAR_FILE_RE = /^\/sync\/[^/]+\/\d{4}\.json(\.tmp)?$/;

let dbPromise = null;

export function isSyncYearFilePath(path) {
	return SYNC_YEAR_FILE_RE.test(makePath(path));
}

function openDb() {
	if (typeof indexedDB === "undefined") {
		return Promise.reject(new Error("IndexedDB unavailable"));
	}
	if (!dbPromise) {
		dbPromise = new Promise((resolve, reject) => {
			const request = indexedDB.open(DB_NAME, DB_VERSION);
			request.onerror = () =>
				reject(request.error || new Error("IDB open failed"));
			request.onblocked = () =>
				reject(new Error("IndexedDB open blocked for sync year files"));
			request.onupgradeneeded = () => {
				const db = request.result;
				if (!db.objectStoreNames.contains(STORE_NAME)) {
					db.createObjectStore(STORE_NAME);
				}
			};
			request.onsuccess = () => resolve(request.result);
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

function runTransaction(mode, work) {
	return openDb().then(
		(db) =>
			new Promise((resolve, reject) => {
				const tx = db.transaction(STORE_NAME, mode);
				const store = tx.objectStore(STORE_NAME);
				let result;
				let workSettled = false;
				let txSettled = false;
				let rejected = false;
				const finish = () => {
					if (rejected || !workSettled || !txSettled) return;
					resolve(result);
				};
				tx.oncomplete = () => {
					txSettled = true;
					finish();
				};
				tx.onerror = () => {
					rejected = true;
					reject(tx.error || new Error("IDB transaction failed"));
				};
				tx.onabort = () => {
					rejected = true;
					reject(tx.error || new Error("IDB transaction aborted"));
				};
				Promise.resolve(work(store))
					.then((value) => {
						result = value;
						workSettled = true;
						finish();
					})
					.catch((err) => {
						rejected = true;
						try {
							tx.abort();
						} catch {
							/* ignore */
						}
						reject(err);
					});
			}),
	);
}

export async function idbReadSyncYearFile(path) {
	const key = makePath(path);
	if (!isSyncYearFilePath(key)) return null;
	const result = await runTransaction("readonly", (store) =>
		requestToPromise(store.get(key)),
	);
	return typeof result === "string" ? result : (result ?? null);
}

export async function idbWriteSyncYearFile(path, content) {
	const key = makePath(path);
	if (!isSyncYearFilePath(key)) {
		throw new Error(`Not a sync year file path: ${key}`);
	}
	const value = typeof content === "string" ? content : String(content ?? "");
	await runTransaction("readwrite", (store) =>
		requestToPromise(store.put(value, key)),
	);
}

export async function idbDeleteSyncYearFile(path) {
	const key = makePath(path);
	if (!isSyncYearFilePath(key)) return;
	await runTransaction("readwrite", (store) =>
		requestToPromise(store.delete(key)),
	);
}

export async function idbExistsSyncYearFile(path) {
	const key = makePath(path);
	if (!isSyncYearFilePath(key)) return false;
	const result = await runTransaction("readonly", (store) =>
		requestToPromise(store.getKey(key)),
	);
	return result != null;
}

export async function idbRenameSyncYearFile(from, to) {
	const fromKey = makePath(from);
	const toKey = makePath(to);
	if (!isSyncYearFilePath(fromKey) || !isSyncYearFilePath(toKey)) {
		throw new Error(`Invalid sync year rename: ${fromKey} → ${toKey}`);
	}
	const content = await idbReadSyncYearFile(fromKey);
	if (content == null) {
		const err = new Error(`ENOENT: ${fromKey}`);
		err.code = "ENOENT";
		throw err;
	}
	await idbWriteSyncYearFile(toKey, content);
	await idbDeleteSyncYearFile(fromKey);
}

/** Year file basenames stored under a group dir like /sync/american */
export async function idbListSyncYearFilesInDir(dirPath) {
	const dir = makePath(dirPath).replace(/\/$/, "");
	const prefix = `${dir}/`;
	const keys = await runTransaction("readonly", (store) =>
		requestToPromise(store.getAllKeys()),
	);
	return (keys || [])
		.map(String)
		.filter((key) => key.startsWith(prefix) && isSyncYearFilePath(key))
		.map((key) => key.slice(prefix.length))
		.filter((name) => /^\d{4}\.json$/.test(name));
}

export async function clearSyncYearFilesDb() {
	dbPromise = null;
	if (typeof indexedDB === "undefined") return;
	await new Promise((resolve, reject) => {
		const req = indexedDB.deleteDatabase(DB_NAME);
		req.onsuccess = () => resolve();
		req.onerror = () => reject(req.error);
		req.onblocked = () => resolve();
	});
}
