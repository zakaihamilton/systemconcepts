export const DATABASE_NAME = "systemconcepts-local-files";
const DATABASE_VERSION = 2;
const FILE_STORE = "files";
const METADATA_STORE = "metadata";
export const LEGACY_DATABASE_NAME = "systemconcepts-fs";
export const LEGACY_ACTIVE_DATABASE_KEY = "local_active_database";

const OPEN_TIMEOUT_MS = 4000;
const MAX_CONNECTION_ATTEMPTS = 3;
const RETRY_PAUSE_MS = [0, 50];

let databasePromise: any = null;
let databaseInstance: any = null;
let connectionGeneration = 0;
let pageLifecycleInstalled = false;

export function requestResult<T = any>(request: IDBRequest<T>): Promise<T> {
	return new Promise<T>((resolve, reject) => {
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}

function transactionComplete(transaction: any) {
	return new Promise<void>((resolve, reject) => {
		transaction.oncomplete = () => resolve();
		transaction.onabort = () => reject(transaction.error);
		transaction.onerror = () => reject(transaction.error);
	});
}

function isUnavailableConnectionError(error: any) {
	if (!error) return false;
	const name = error.name || "";
	const message = String(error.message || error);
	if (
		name === "InvalidStateError" ||
		name === "UnknownError" ||
		name === "AbortError"
	) {
		return true;
	}
	return /connection is closing|database connection is closing|Connection to Indexed Database server lost|InvalidStateError|Internal error was encountered in the Indexed Database server|timed out/i.test(
		message,
	);
}

function closeDatabase(database: any) {
	if (!database) return;
	try {
		database.onclose = null;
		database.onversionchange = null;
		database.close();
	} catch {
		// The connection may already have been closed by the browser.
	}
}

function discardCachedConnection() {
	connectionGeneration += 1;
	databasePromise = null;
	databaseInstance = null;
}

function forgetDatabase() {
	const database: any = databaseInstance;
	const pending: any = databasePromise;
	discardCachedConnection();
	closeDatabase(database);
	if (pending) {
		pending.then(closeDatabase).catch(() => {});
	}
}

// Chromium (Android Chrome) freezes background tabs. Closing IndexedDB inside
// the freeze handler can crash the renderer; drop the JS handle now and close
// on a timer that runs after resume.
function releaseFrozenConnection() {
	const database: any = databaseInstance;
	discardCachedConnection();
	if (!database) return;
	setTimeout(() => closeDatabase(database), 0);
}

function attachDatabaseLifecycle(database: any, generation: any) {
	if (generation !== connectionGeneration) {
		closeDatabase(database);
		return false;
	}
	databaseInstance = database;
	database.onclose = () => {
		if (databaseInstance === database) {
			databasePromise = null;
			databaseInstance = null;
		}
	};
	database.onversionchange = () => {
		if (databaseInstance === database) {
			forgetDatabase();
		}
	};
	return true;
}

function installPageLifecycleHandlers() {
	if (pageLifecycleInstalled || typeof window === "undefined") return;
	pageLifecycleInstalled = true;
	window.addEventListener("pagehide", (event) => {
		if (event.persisted) releaseFrozenConnection();
		else forgetDatabase();
	});
	// Android Chrome restores via resume/pageshow/focus. Close here (the page
	// is visible again) so the next access opens a live connection.
	const releaseForResume = () => forgetDatabase();
	window.addEventListener("pageshow", releaseForResume);
	window.addEventListener("focus", releaseForResume);
	document.addEventListener("freeze", releaseFrozenConnection);
	document.addEventListener("resume", releaseForResume);
	document.addEventListener("visibilitychange", () => {
		if (document.visibilityState === "visible") releaseForResume();
	});
}

function upgradeDatabase(request: any) {
	const database = request.result;
	const transaction = request.transaction;
	const files = database.objectStoreNames.contains(FILE_STORE)
		? transaction.objectStore(FILE_STORE)
		: database.createObjectStore(FILE_STORE, { keyPath: "path" });
	const metadata = database.objectStoreNames.contains(METADATA_STORE)
		? transaction.objectStore(METADATA_STORE)
		: database.createObjectStore(METADATA_STORE, { keyPath: "path" });

	// Version 1 stored metadata and content together. Copy only the
	// metadata so future listings never clone file bodies.
	if (request.oldVersion < 2 && database.objectStoreNames.contains("entries")) {
		const legacyEntries = transaction.objectStore("entries");
		legacyEntries.openCursor().onsuccess = (event: any) => {
			const cursor = event.target.result;
			if (!cursor) return;
			const { content, ...entry } = cursor.value;
			metadata.put(entry);
			if (entry.type === "file") files.put({ path: entry.path, content });
			cursor.continue();
		};
	}
}

function openDatabase() {
	const generation = connectionGeneration;
	return new Promise((resolve, reject) => {
		let settled = false;
		let timeoutId: ReturnType<typeof setTimeout> | undefined;
		const finish = (error: Error | null, database?: IDBDatabase) => {
			if (settled) {
				if (database) closeDatabase(database);
				return;
			}
			settled = true;
			clearTimeout(timeoutId);
			if (error) {
				if (generation === connectionGeneration) databasePromise = null;
				reject(error);
				return;
			}
			if (!attachDatabaseLifecycle(database, generation)) {
				const lost = new Error("IndexedDB connection was replaced");
				lost.name = "AbortError";
				reject(lost);
				return;
			}
			resolve(database);
		};
		timeoutId = setTimeout(() => {
			const error = new Error("IndexedDB open timed out");
			error.name = "UnknownError";
			finish(error);
		}, OPEN_TIMEOUT_MS);
		const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
		request.onupgradeneeded = () => upgradeDatabase(request);
		request.onsuccess = () => finish(null, request.result);
		request.onerror = () =>
			finish(request.error || new Error("IndexedDB open failed"));
		request.onblocked = () => {
			if (databaseInstance) forgetDatabase();
		};
	});
}

function getDatabase() {
	if (typeof indexedDB === "undefined") {
		return Promise.reject(new Error("IndexedDB is unavailable"));
	}
	installPageLifecycleHandlers();
	if (!databasePromise) {
		databasePromise = openDatabase();
	}
	return databasePromise;
}

export async function withStores(mode: any, callback: any, attempt = 0) {
	let transaction;
	let completed;
	try {
		const database = await getDatabase();
		transaction = database.transaction([FILE_STORE, METADATA_STORE], mode);
		const stores = {
			files: transaction.objectStore(FILE_STORE),
			metadata: transaction.objectStore(METADATA_STORE),
		};
		completed = transactionComplete(transaction);
		try {
			const result = await callback(stores);
			await completed;
			return result;
		} catch (error: any) {
			try {
				transaction.abort();
			} catch {
				// The transaction may already have completed.
			}
			await completed.catch(() => {});
			throw error;
		}
	} catch (error: any) {
		if (
			attempt + 1 < MAX_CONNECTION_ATTEMPTS &&
			isUnavailableConnectionError(error)
		) {
			forgetDatabase();
			const pause = RETRY_PAUSE_MS[attempt] || 0;
			if (pause) {
				await new Promise((resolve) => setTimeout(resolve, pause));
			}
			return withStores(mode, callback, attempt + 1);
		}
		throw error;
	}
}
