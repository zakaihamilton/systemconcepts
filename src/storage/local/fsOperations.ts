import { isBinaryFile, makePath } from "@util/data/path";
import {
	DATABASE_NAME,
	LEGACY_ACTIVE_DATABASE_KEY,
	LEGACY_DATABASE_NAME,
	requestResult,
	withStores,
} from "./idbConnection";

function filesystemError(code: any, path: any) {
	const error = new Error(`${code}: ${path}`) as Error & { code: string };
	error.code = code;
	return error;
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

export const localFileSystem = {
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
