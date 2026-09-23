import { isBinaryFile, makePath } from "@util/data/path";

const DATABASE_NAME = "systemconcepts-local-files";
const DATABASE_VERSION = 2;
const FILE_STORE = "files";
const METADATA_STORE = "metadata";
const LEGACY_DATABASE_NAME = "systemconcepts-fs";
const LEGACY_ACTIVE_DATABASE_KEY = "local_active_database";

const OPEN_TIMEOUT_MS = 4000;
const MAX_CONNECTION_ATTEMPTS = 3;
const RETRY_PAUSE_MS = [0, 50];

let databasePromise: any = null;
let databaseInstance: any = null;
let connectionGeneration = 0;
let pageLifecycleInstalled = false;

function filesystemError(code: any, path: any) {
	const error = new Error(`${code}: ${path}`) as Error & { code: string };
	error.code = code;
	return error;
}

function requestResult<T = any>(request: IDBRequest<T>): Promise<T> {
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

async function withStores(mode: any, callback: any, attempt = 0) {
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

function parentPaths(path: any) {
	const parts = makePath(path).split("/").filter(Boolean);
	const parents = [];
	for (let index = 1; index < parts.length; index++) {
		parents.push(`/${parts.slice(0, index).join("/")}`);
	}
	return parents;
}

function entrySize(content: any) {
	if (typeof content === "string") return new Blob([content]).size;
	if (content instanceof ArrayBuffer) return content.byteLength;
	if (ArrayBuffer.isView(content)) return content.byteLength;
	return new Blob([content]).size;
}

async function ensureParents(metadata: any, path: any) {
	for (const parentPath of parentPaths(path)) {
		const existing = await requestResult(metadata.get(parentPath));
		if (!existing) {
			metadata.put({
				path: parentPath,
				type: "dir",
				mtimeMs: Date.now(),
				size: 0,
			});
		}
	}
}

async function getEntries() {
	return withStores("readonly", ({ metadata }: any) =>
		requestResult(metadata.getAll()),
	);
}

async function getMetadata(path: any) {
	return withStores("readonly", ({ metadata }: any) =>
		requestResult(metadata.get(makePath(path))),
	);
}

async function getListing(path: any, options: Record<string, any> = {}) {
	const root = makePath(path);
	const prefix = root === "/" ? "/" : `${root}/`;
	const children = new Map<any, any>();
	const entries = await getEntries();
	if (
		options.strict &&
		root !== "/" &&
		!entries.some(
			(entry: any) => entry.path === root || entry.path.startsWith(prefix),
		)
	) {
		throw filesystemError("ENOENT", root);
	}
	for (const entry of entries) {
		if (entry.path === root || !entry.path.startsWith(prefix)) continue;
		const remainder = entry.path.slice(prefix.length);
		const [name, ...nested] = remainder.split("/");
		const childPath = makePath(root, name);
		const isDirectory = nested.length > 0 || entry.type === "dir";
		const previous = children.get(childPath);
		children.set(childPath, {
			path: childPath,
			name,
			type: isDirectory ? "dir" : "file",
			size: isDirectory ? 0 : entry.size || 0,
			mtimeMs: previous?.mtimeMs || entry.mtimeMs || 0,
		});
	}
	return [...children.values()].map((entry) => {
		let count;
		if (options.useCount && entry.type === "dir") {
			const childPrefix = `${entry.path}/`;
			count = new Set(
				entries
					.filter((candidate: any) => candidate.path.startsWith(childPrefix))
					.filter((candidate: any) => {
						const remainder = candidate.path.slice(childPrefix.length);
						return remainder.includes("/") || candidate.type === "dir";
					})
					.map(
						(candidate: any) =>
							candidate.path.slice(childPrefix.length).split("/")[0],
					),
			).size;
		}
		return {
			...entry,
			id: makePath("local", entry.path),
			path: makePath("local", entry.path),
			count,
		};
	});
}

async function createFolder(path: any) {
	path = makePath(path);
	if (path === "/") return;
	await withStores("readwrite", async ({ metadata }: any) => {
		const existing = await requestResult(metadata.get(path));
		if (existing) {
			if (existing.type !== "dir") throw filesystemError("EEXIST", path);
			return;
		}
		await ensureParents(metadata, path);
		metadata.put({ path, type: "dir", mtimeMs: Date.now(), size: 0 });
	});
}

async function createFolders(prefix: any, folders: any) {
	for (const path of folders) await createFolder(makePath(prefix, path));
}

async function createFolderPath(path: any, isFolder = false) {
	path = makePath(path);
	const target = isFolder ? path : path.slice(0, path.lastIndexOf("/")) || "/";
	if (target !== "/") await createFolder(target);
}

async function deleteFolder(root: any) {
	root = makePath(root);
	const prefix = root === "/" ? "/" : `${root}/`;
	await withStores("readwrite", async ({ files, metadata }: any) => {
		for (const entry of await requestResult(metadata.getAll())) {
			if (
				root === "/" ||
				entry.path === root ||
				entry.path.startsWith(prefix)
			) {
				metadata.delete(entry.path);
				files.delete(entry.path);
			}
		}
	});
}

async function deleteFile(path: any) {
	path = makePath(path);
	await withStores("readwrite", async ({ files, metadata }: any) => {
		const entry = await requestResult(metadata.get(path));
		if (!entry || entry.type !== "file") throw filesystemError("ENOENT", path);
		metadata.delete(path);
		files.delete(path);
	});
}

async function rename(from: any, to: any) {
	from = makePath(from);
	to = makePath(to);
	const prefix = `${from}/`;
	await withStores("readwrite", async ({ files, metadata }: any) => {
		const entries = (await requestResult(metadata.getAll())).filter(
			(entry: any) => entry.path === from || entry.path.startsWith(prefix),
		);
		if (entries.length === 0) throw filesystemError("ENOENT", from);
		const fileContents = new Map<any, any>();
		for (const entry of entries) {
			if (entry.type === "file") {
				fileContents.set(
					entry.path,
					await requestResult(files.get(entry.path)),
				);
			}
		}
		await ensureParents(metadata, to);
		for (const entry of entries) {
			metadata.delete(entry.path);
			files.delete(entry.path);
		}
		for (const entry of entries) {
			const path =
				entry.path === from ? to : `${to}${entry.path.slice(from.length)}`;
			metadata.put({ ...entry, path, mtimeMs: Date.now() });
			if (entry.type === "file") {
				files.put({ path, content: fileContents.get(entry.path)?.content });
			}
		}
	});
}

async function readFile(path: any) {
	path = makePath(path);
	return withStores("readonly", async ({ files, metadata }: any) => {
		const entry = await requestResult(metadata.get(path));
		if (!entry) return null;
		if (entry.type !== "file") throw filesystemError("EISDIR", path);
		const file = await requestResult(files.get(path));
		return file?.content ?? null;
	});
}

async function readFiles(prefix: any, files: any) {
	const results: Record<string, any> = {};
	for (const name of files)
		results[name] = await readFile(makePath(prefix, name));
	return results;
}

async function writeFile(path: any, content: any) {
	path = makePath(path);
	await withStores("readwrite", async ({ files, metadata }: any) => {
		await ensureParents(metadata, path);
		files.put({ path, content });
		metadata.put({
			path,
			type: "file",
			binary: isBinaryFile(path),
			size: entrySize(content),
			mtimeMs: Date.now(),
		});
	});
}

async function writeFiles(prefix: any, files: any) {
	for (const path in files)
		await writeFile(makePath(prefix, path), files[path]);
}

async function exists(path: any) {
	path = makePath(path);
	if (path === "/") return true;
	if (await getMetadata(path)) return true;
	return (await getEntries()).some((entry: any) =>
		entry.path.startsWith(`${path}/`),
	);
}

function deleteDatabaseBestEffort(name: any) {
	if (!name || name === DATABASE_NAME || typeof indexedDB === "undefined") {
		return;
	}
	try {
		indexedDB.deleteDatabase(name);
	} catch {
		// Browser storage cleanup is best effort; an open old tab can block it.
	}
}

function clearLegacyLightningFs() {
	if (typeof localStorage === "undefined") {
		deleteDatabaseBestEffort(LEGACY_DATABASE_NAME);
		return;
	}
	const activeDatabaseName = localStorage.getItem(LEGACY_ACTIVE_DATABASE_KEY);
	deleteDatabaseBestEffort(LEGACY_DATABASE_NAME);
	deleteDatabaseBestEffort(activeDatabaseName);
	localStorage.removeItem(LEGACY_ACTIVE_DATABASE_KEY);
}

/** Clear the native local store before a user-requested Full Sync. */
export async function resetLocalFileSystem() {
	await withStores("readwrite", ({ files, metadata }: any) => {
		files.clear();
		metadata.clear();
	});
	clearLegacyLightningFs();
	return DATABASE_NAME;
}

export async function clear() {
	if (typeof indexedDB === "undefined") return;
	await resetLocalFileSystem();
}

async function getRecursiveList(
	path: any,
	options: Record<string, any> = {},
): Promise<any[]> {
	const listing: any[] = [];
	for (const item of await getListing(path, options)) {
		listing.push(item);
		if (item.type === "dir") {
			listing.push(
				...(await getRecursiveList(item.path.replace(/^\/local/, ""), options)),
			);
		}
	}
	return listing;
}

export default {
	getListing,
	createFolder,
	createFolders,
	createFolderPath,
	deleteFolder,
	deleteFile,
	rename,
	readFile,
	readFiles,
	writeFile,
	writeFiles,
	exists,
	async getSize() {
		if (typeof navigator !== "undefined" && navigator.storage?.estimate) {
			const estimate = await navigator.storage.estimate();
			return estimate.usage || 0;
		}
		return (await getEntries()).reduce(
			(total: any, entry: any) => total + (entry.size || 0),
			0,
		);
	},
	getRecursiveList,
	resetLocalFileSystem,
};
