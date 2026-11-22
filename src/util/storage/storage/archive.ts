import { logger as structuredLogger } from "@util/api/logger";
import { isBinaryFile, makePath } from "@util/data/path";
import JSZip from "jszip";
import { storageMethods } from "./dispatch";

export async function exportFolder(path: any) {
	const toData = async (path: any) => {
		const data: Record<string, unknown> = {};
		const items = await storageMethods.getListing(path);
		for (const item of items) {
			const { name, type, path } = item;
			try {
				if (type === "dir") {
					const result = await toData(path);
					data[name] = result;
				} else if (!isBinaryFile(path)) {
					data[name] = await storageMethods.readFile(path);
				}
			} catch (err: any) {
				structuredLogger.error(err);
			}
		}
		return data;
	};
	return await toData(path);
}

export async function exportFolderAsZip(path: any) {
	const zip = new JSZip();
	const rootPath = makePath(path);

	const addToZip = async (currentPath: any, currentZipFolder: any) => {
		const items = await storageMethods.getListing(currentPath);
		for (const item of items) {
			const { name, type, path: itemPath } = item;
			try {
				if (type === "dir") {
					const folder = currentZipFolder.folder(name);
					await addToZip(itemPath, folder);
				} else {
					const content = await storageMethods.readFile(itemPath);
					if (content !== null) {
						const isBinary = isBinaryFile(itemPath);
						if (isBinary && typeof content === "string") {
							currentZipFolder.file(name, content, { base64: true });
						} else {
							currentZipFolder.file(name, content);
						}
					}
				}
			} catch (err: any) {
				structuredLogger.error(err);
			}
		}
	};

	await addToZip(rootPath, zip);
	return await zip.generateAsync({ type: "blob" });
}

export async function importFolder(path: any, data: any) {
	const fromData = async (root: any, data: any) => {
		await storageMethods.createFolder(root);
		const keys = Object.keys(data);
		for (const key of keys) {
			const path = makePath(root, key);
			const value = data[key];
			if (typeof value === "object") {
				await storageMethods.createFolder(path);
				if (Array.isArray(value)) {
					for (const item of value) {
						if (typeof item === "object") {
							const name = item.id || item.name;
							await fromData(makePath(path, name), item);
						}
					}
				} else {
					await fromData(path, value);
				}
			} else if (typeof value === "string") {
				await storageMethods.writeFile(path, value);
			}
		}
	};
	await fromData(path, data);
}

export async function copyFolder(from: any, to: any) {
	if (makePath(from) === makePath(to)) {
		return;
	}
	await storageMethods.createFolderPath(to, true);
	const items = await storageMethods.getListing(from);
	for (const item of items) {
		const { name, type } = item;
		const fromPath = makePath(from, name);
		const toPath = makePath(to, name);
		if (type === "dir") {
			await copyFolder(fromPath, toPath);
		} else {
			await copyFile(fromPath, toPath);
		}
	}
}

export async function copyFile(from: any, to: any) {
	if (makePath(from) === makePath(to)) {
		return;
	}
	const data = await storageMethods.readFile(from);
	await storageMethods.writeFile(to, data);
}

export async function moveFolder(from: any, to: any) {
	if (makePath(from) === makePath(to)) {
		return;
	}
	await copyFolder(from, to);
	await storageMethods.deleteFolder(from);
}

export async function moveFile(from: any, to: any) {
	if (makePath(from) === makePath(to)) {
		return;
	}
	await copyFile(from, to);
	await storageMethods.deleteFile(from);
}
