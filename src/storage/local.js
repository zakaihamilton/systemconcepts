import { isBinaryFile, makePath } from "@util/data/path";

const DATABASE_NAME = "systemconcepts-local-files";
const DATABASE_VERSION = 2;
const FILE_STORE = "files";
const METADATA_STORE = "metadata";
const LEGACY_DATABASE_NAME = "systemconcepts-fs";
const LEGACY_ACTIVE_DATABASE_KEY = "local_active_database";

let databasePromise = null;

function filesystemError(code, path) {
	const error = new Error(`${code}: ${path}`);
	error.code = code;
	return error;
}

function requestResult(request) {
	return new Promise((resolve, reject) => {
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}

function transactionComplete(transaction) {
	return new Promise((resolve, reject) => {
		transaction.oncomplete = () => resolve();
		transaction.onabort = () => reject(transaction.error);
		transaction.onerror = () => reject(transaction.error);
	});
}

function getDatabase() {
	if (typeof indexedDB === "undefined") {
		return Promise.reject(new Error("IndexedDB is unavailable"));
	}
	if (!databasePromise) {
		databasePromise = new Promise((resolve, reject) => {
			const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
			request.onupgradeneeded = () => {
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
				if (
					request.oldVersion < 2 &&
					database.objectStoreNames.contains("entries")
				) {
					const legacyEntries = transaction.objectStore("entries");
					legacyEntries.openCursor().onsuccess = (event) => {
						const cursor = event.target.result;
						if (!cursor) return;
						const { content, ...entry } = cursor.value;
						metadata.put(entry);
						if (entry.type === "file") files.put({ path: entry.path, content });
						cursor.continue();
					};
				}
			};
			request.onsuccess = () => resolve(request.result);
			request.onerror = () => {
				databasePromise = null;
				reject(request.error);
			};
		});
	}
	return databasePromise;
}

async function withStores(mode, callback) {
	const database = await getDatabase();
	const transaction = database.transaction([FILE_STORE, METADATA_STORE], mode);
	const stores = {
		files: transaction.objectStore(FILE_STORE),
		metadata: transaction.objectStore(METADATA_STORE),
	};
	const completed = transactionComplete(transaction);
	try {
		const result = await callback(stores);
		await completed;
		return result;
	} catch (error) {
		try {
			transaction.abort();
		} catch {
			// The transaction may already have completed.
		}
		await completed.catch(() => {});
		throw error;
	}
}

function parentPaths(path) {
	const parts = makePath(path).split("/").filter(Boolean);
	const parents = [];
	for (let index = 1; index < parts.length; index++) {
		parents.push(`/${parts.slice(0, index).join("/")}`);
	}
	return parents;
}

function entrySize(content) {
	if (typeof content === "string") return new Blob([content]).size;
	if (content instanceof ArrayBuffer) return content.byteLength;
	if (ArrayBuffer.isView(content)) return content.byteLength;
	return new Blob([content]).size;
}

async function ensureParents(metadata, path) {
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
	return withStores("readonly", ({ metadata }) =>
		requestResult(metadata.getAll()),
	);
}

async function getMetadata(path) {
	return withStores("readonly", ({ metadata }) =>
		requestResult(metadata.get(makePath(path))),
	);
}

async function getListing(path, options = {}) {
	const root = makePath(path);
	const prefix = root === "/" ? "/" : `${root}/`;
	const children = new Map();
	const entries = await getEntries();
	if (
		options.strict &&
		root !== "/" &&
		!entries.some(
			(entry) => entry.path === root || entry.path.startsWith(prefix),
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
					.filter((candidate) => candidate.path.startsWith(childPrefix))
					.filter((candidate) => {
						const remainder = candidate.path.slice(childPrefix.length);
						return remainder.includes("/") || candidate.type === "dir";
					})
					.map(
						(candidate) =>
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

async function createFolder(path) {
	path = makePath(path);
	if (path === "/") return;
	await withStores("readwrite", async ({ metadata }) => {
		const existing = await requestResult(metadata.get(path));
		if (existing) {
			if (existing.type !== "dir") throw filesystemError("EEXIST", path);
			return;
		}
		await ensureParents(metadata, path);
		metadata.put({ path, type: "dir", mtimeMs: Date.now(), size: 0 });
	});
}

async function createFolders(prefix, folders) {
	for (const path of folders) await createFolder(makePath(prefix, path));
}

async function createFolderPath(path, isFolder = false) {
	path = makePath(path);
	const target = isFolder ? path : path.slice(0, path.lastIndexOf("/")) || "/";
	if (target !== "/") await createFolder(target);
}

async function deleteFolder(root) {
	root = makePath(root);
	const prefix = root === "/" ? "/" : `${root}/`;
	await withStores("readwrite", async ({ files, metadata }) => {
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

async function deleteFile(path) {
	path = makePath(path);
	await withStores("readwrite", async ({ files, metadata }) => {
		const entry = await requestResult(metadata.get(path));
		if (!entry || entry.type !== "file") throw filesystemError("ENOENT", path);
		metadata.delete(path);
		files.delete(path);
	});
}

async function rename(from, to) {
	from = makePath(from);
	to = makePath(to);
	const prefix = `${from}/`;
	await withStores("readwrite", async ({ files, metadata }) => {
		const entries = (await requestResult(metadata.getAll())).filter(
			(entry) => entry.path === from || entry.path.startsWith(prefix),
		);
		if (entries.length === 0) throw filesystemError("ENOENT", from);
		const fileContents = new Map();
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

async function readFile(path) {
	path = makePath(path);
	return withStores("readonly", async ({ files, metadata }) => {
		const entry = await requestResult(metadata.get(path));
		if (!entry) return null;
		if (entry.type !== "file") throw filesystemError("EISDIR", path);
		const file = await requestResult(files.get(path));
		return file?.content ?? null;
	});
}

async function readFiles(prefix, files) {
	const results = {};
	for (const name of files)
		results[name] = await readFile(makePath(prefix, name));
	return results;
}

async function writeFile(path, content) {
	path = makePath(path);
	await withStores("readwrite", async ({ files, metadata }) => {
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

async function writeFiles(prefix, files) {
	for (const path in files)
		await writeFile(makePath(prefix, path), files[path]);
}

async function exists(path) {
	path = makePath(path);
	if (path === "/") return true;
	if (await getMetadata(path)) return true;
	return (await getEntries()).some((entry) =>
		entry.path.startsWith(`${path}/`),
	);
}

function deleteDatabaseBestEffort(name) {
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
	await withStores("readwrite", ({ files, metadata }) => {
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

async function getRecursiveList(path, options = {}) {
	const listing = [];
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
			(total, entry) => total + (entry.size || 0),
			0,
		);
	},
	getRecursiveList,
	resetLocalFileSystem,
};
