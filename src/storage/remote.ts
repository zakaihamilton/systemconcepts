import { fetchJSON } from "@util/api/fetch";
import { makePath } from "@util/data/path";

type RemoteStorageConfig = {
	fsEndPoint: string;
	deviceId: string;
};

type RemoteFileStat = {
	type?: "file" | "dir";
	size?: number;
	mtimeMs?: number;
};

type RemoteFileRecord = {
	id?: string;
	name?: string;
	folder?: string;
	path?: string;
	type?: "file" | "dir";
	size?: number;
	mtimeMs?: number;
	stat?: RemoteFileStat;
	deleted?: boolean;
	body?: string;
	count?: number;
};

export default function remoteStorage({
	fsEndPoint,
	deviceId,
}: RemoteStorageConfig) {
	async function getListing(
		path: string,
		options: { useCount?: boolean } = {},
	): Promise<RemoteFileRecord[]> {
		path = makePath(path);
		const { useCount } = options;
		const listing: RemoteFileRecord[] = [];
		const items = (await fetchJSON(fsEndPoint, {
			method: "GET",
			headers: {
				query: encodeURIComponent(JSON.stringify({ folder: path })),
				fields: encodeURIComponent(
					JSON.stringify({ folder: 1, name: 1, stat: 1, deleted: 1 }),
				),
			},
		})) as RemoteFileRecord[];
		for (const item of items) {
			const { name, stat = {}, deleted } = item;
			const itemPath = makePath(path, name);
			if (deleted) {
				continue;
			}
			if (useCount && stat.type === "dir") {
				const children = (await fetchJSON(fsEndPoint, {
					method: "GET",
					headers: {
						query: encodeURIComponent(JSON.stringify({ folder: itemPath })),
						fields: encodeURIComponent(
							JSON.stringify({ folder: 1, name: 1, stat: 1 }),
						),
					},
				})) as RemoteFileRecord[];
				let count = 0;
				for (const item of children) {
					if (item.stat?.type === "dir") {
						count++;
					}
				}
				item.count = count;
			}
			Object.assign(item, stat);
			item.id = item.path = makePath(deviceId, itemPath);
			item.name = name;
			listing.push(item);
		}
		return listing;
	}

	async function getRecursiveList(path: string): Promise<RemoteFileRecord[]> {
		path = makePath(path);
		if (!(await exists(path))) {
			return [];
		}
		const listing: RemoteFileRecord[] = [];

		// Ensure trailing slash for directory prefix match to avoid partial matches
		// e.g. "metadata/session" matching "metadata/sessions_old"
		const prefix = path.endsWith("/") ? path : path + "/";

		const items = (await fetchJSON(fsEndPoint, {
			method: "GET",
			headers: {
				prefix: encodeURIComponent(prefix),
				fields: encodeURIComponent(
					JSON.stringify({ folder: 1, name: 1, stat: 1, deleted: 1, id: 1 }),
				),
			},
		})) as RemoteFileRecord[];

		const validFolders = new Set<string>([path]);
		for (const item of items) {
			const { stat = {}, deleted, id } = item;
			if (!deleted && stat.type === "dir" && id) {
				validFolders.add(id);
			}
		}

		for (const item of items) {
			const { stat = {}, deleted, id, folder } = item;
			if (deleted) {
				continue;
			}
			if (!folder || !validFolders.has(folder)) {
				continue;
			}
			// item.id is the full path in mongo.
			// We need to reconstruct the return object consistent with getListing
			Object.assign(item, stat);
			// item.path should include deviceId for the consumer
			item.path = makePath(deviceId, id);
			// item.id also
			item.id = item.path;

			listing.push(item);
		}
		return listing;
	}

	async function createFolder(path: string) {
		path = makePath(path);
		if (!(await exists(path))) {
			await fetchJSON(fsEndPoint, {
				method: "PUT",
				body: JSON.stringify([
					{
						id: path,
						name: path.split("/").filter(Boolean).pop(),
						folder:
							"/" + path.split("/").filter(Boolean).slice(0, -1).join("/"),
						stat: {
							type: "dir",
							mtimeMs: new Date().getTime(),
						},
					},
				]),
			});
		}
	}

	async function createFolders(prefix: string, folders: string[]) {
		const maxBytes = 4000 * 1000;
		let batch: RemoteFileRecord[] = [];
		for (const name of folders) {
			const path = makePath(prefix + name);
			if (JSON.stringify(batch).length > maxBytes) {
				await fetchJSON(fsEndPoint, {
					method: "PUT",
					body: batch,
				});
				batch = [];
			}
			batch.push({
				id: path,
				name: path.split("/").filter(Boolean).pop(),
				folder: "/" + path.split("/").filter(Boolean).slice(0, -1).join("/"),
				stat: {
					type: "dir",
					mtimeMs: new Date().getTime(),
				},
			});
		}
		if (batch.length) {
			await fetchJSON(fsEndPoint, {
				method: "PUT",
				body: JSON.stringify(batch),
			});
		}
	}

	async function createFolderPath(path: string, isFolder = false) {
		path = makePath(path);
		const parts = path.split("/");
		let partIndex = parts.length - 1;
		for (; partIndex > 1; partIndex--) {
			const subPath = parts.slice(0, partIndex).join("/");
			if (await exists(subPath)) {
				break;
			}
		}
		for (
			partIndex++;
			partIndex < parts.length + Number(isFolder);
			partIndex++
		) {
			const subPath = parts.slice(0, partIndex).join("/");
			await createFolder(subPath);
		}
	}

	async function deleteFolder(root: string) {
		root = makePath(root);
		const listing = await getListing(root);
		for (const item of listing) {
			const path = [root, item.name].filter(Boolean).join("/");
			if (item.stat?.type === "dir") {
				await deleteFolder(path);
			} else {
				await deleteFile(path);
			}
		}
		await fetchJSON(fsEndPoint, {
			method: "PUT",
			body: JSON.stringify([
				{
					id: root,
					name: root.split("/").filter(Boolean).pop(),
					folder: "/" + root.split("/").filter(Boolean).slice(0, -1).join("/"),
					stat: {
						type: "dir",
						mtimeMs: new Date().getTime(),
					},
					deleted: true,
				},
			]),
		});
	}

	async function deleteFile(path: string) {
		path = makePath(path);
		await fetchJSON(fsEndPoint, {
			method: "PUT",
			body: JSON.stringify([
				{
					id: path,
					name: path.split("/").filter(Boolean).pop(),
					folder: "/" + path.split("/").filter(Boolean).slice(0, -1).join("/"),
					stat: {
						type: "file",
						size: 0,
						mtimeMs: new Date().getTime(),
					},
					body: "",
					deleted: true,
				},
			]),
		});
	}

	async function readFile(
		path: string,
	): Promise<string | false | null | undefined> {
		path = makePath(path);
		const item = await fetchJSON(fsEndPoint, {
			method: "GET",
			headers: {
				id: encodeURIComponent(path),
			},
		});
		const file = item as RemoteFileRecord | null;
		return file && !file.deleted && file.body;
	}

	async function readFiles(
		prefix: string,
		files: string[],
	): Promise<Record<string, string | undefined>> {
		const results: Record<string, string | undefined> = {};
		let filesToRead = files.map((name) => makePath(prefix + name));
		while (filesToRead.length) {
			const result = (await fetchJSON(fsEndPoint, {
				method: "POST",
				body: JSON.stringify(filesToRead),
			})) as RemoteFileRecord[] | null;
			if (!result || !result.length) {
				break;
			}
			filesToRead = filesToRead.filter(
				(path) => !result.find((item) => item.id === path),
			);
			for (const item of result) {
				if (item.id) results[item.id] = item.body;
			}
		}
		return results;
	}

	async function writeFile(path: string, body = "") {
		path = makePath(path);
		await fetchJSON(fsEndPoint, {
			method: "PUT",
			body: JSON.stringify([
				{
					id: path,
					name: path.split("/").filter(Boolean).pop(),
					folder: "/" + path.split("/").filter(Boolean).slice(0, -1).join("/"),
					stat: {
						type: "file",
						size: body.length,
						mtimeMs: new Date().getTime(),
					},
					body,
				},
			]),
		});
	}

	async function writeFiles(prefix: string, files: Record<string, string>) {
		const maxBytes = 4000 * 1000;
		let batch: RemoteFileRecord[] = [];
		for (const name in files) {
			const path = makePath(prefix + name);
			const body = files[name] || "";
			if (JSON.stringify(batch).length + body.length > maxBytes) {
				await fetchJSON(fsEndPoint, {
					method: "PUT",
					body: JSON.stringify(batch),
				});
				batch = [];
			}
			batch.push({
				id: path,
				name: path.split("/").filter(Boolean).pop(),
				folder: "/" + path.split("/").filter(Boolean).slice(0, -1).join("/"),
				stat: {
					type: "file",
					size: body.length,
					mtimeMs: new Date().getTime(),
				},
				body,
			});
		}
		if (batch.length) {
			await fetchJSON(fsEndPoint, {
				method: "PUT",
				body: JSON.stringify(batch),
			});
		}
	}

	async function exists(path: string): Promise<boolean> {
		path = makePath(path);
		try {
			const item = await fetchJSON(fsEndPoint, {
				method: "GET",
				headers: {
					id: encodeURIComponent(path),
				},
			});
			return !!item && !item.deleted;
		} catch (error) {
			// fetchJSON rejects with the HTTP status for non-200 responses. Only a
			// 404 means the path is absent; outages and authorization failures must
			// reach the caller instead of making a later PUT look safe.
			if (error === 404) return false;
			throw error;
		}
	}

	return {
		getListing,
		getRecursiveList,
		createFolder,
		createFolders,
		createFolderPath,
		deleteFolder,
		deleteFile,
		readFile,
		readFiles,
		writeFile,
		writeFiles,
		exists,
		async rename() {
			/* local-only */
		},
	};
}
