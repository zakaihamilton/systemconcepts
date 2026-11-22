import storage from "@data/storage";
import { logger as structuredLogger } from "@util/api/logger";
import pLimit from "@util/data/p-limit";
import { makePath } from "@util/data/path";

const limit = pLimit(20);

/**
 * Dispatch a storage operation to the adapter encoded in the device-prefixed URL.
 * @param {{name: string, types?: string[]}} item
 * @param {string} url
 * @param {...unknown} params
 * @returns {Promise<unknown>}
 */
export async function callMethod(item: any, url = "", ...params: any[]) {
	if (!url) {
		url = "";
	}
	const { name, types } = item;
	const [deviceId, ...other] = url.split("/").filter(Boolean);
	const path = other.join("/");
	if (!deviceId) {
		if (name === "getListing") {
			const options = params[0] || {};
			const { useCount, useSize } = options;
			const results = [];
			for (const device of storage) {
				let enabled = device.enabled;
				if (typeof enabled === "function") {
					enabled = enabled();
				}
				if (!enabled) {
					continue;
				}
				const result = Object.assign({}, device);
				if (useCount) {
					const items =
						(await storageMethods.getListing(device.id, ...params)) || [];
					result.count = items.length;
				}
				if (useSize) {
					if (device.id === "local") {
						try {
							const items = await getRecursiveList(device.id);
							result.size = (items || []).reduce(
								(total: any, item: any) => total + (item.size || 0),
								0,
							);
						} catch (err: any) {
							structuredLogger.error(err);
							result.size = 0;
						}
					} else {
						const method = device.getSize;
						if (method) {
							result.size = await method.call(device);
							structuredLogger.debug(
								`[Storage] Device: ${device.id}, fetched size: ${result.size}`,
							);
						}
					}
				}
				results.push(result);
			}
			return results;
		}
	}
	const device = storage.find((device) => device.id === deviceId);
	if (!device) {
		return null;
	}
	let result = null;
	const method = device[name];
	if (!method) {
		return null;
	}

	if (name === "getListing" && deviceId) {
		const options = params[0] || {};
		const { useSize } = options;
		const items = await method(makePath(path), ...params);
		if (useSize && deviceId === "local" && items) {
			for (const item of items) {
				if (item.type === "dir") {
					try {
						const children = await getRecursiveList(item.id);
						item.size = (children || []).reduce(
							(total: any, child: any) => total + (child.size || 0),
							0,
						);
					} catch (err: any) {
						structuredLogger.error(err);
						item.size = 0;
					}
				}
			}
		}
		return items;
	}
	if (types) {
		params = params.map((param, index) => {
			const type = types[index];
			if (type === "path") {
				const [, ...other] = param.split("/").filter(Boolean);
				const path = other.join("/");
				return makePath(path);
			}
			return param;
		});
	}
	try {
		result = await method(makePath(path), ...params);
	} catch (err: any) {
		// Only log errors that aren't common filesystem conflicts
		const errorInfo =
			err && typeof err === "object"
				? (err as { code?: string; message?: string })
				: undefined;
		const errorStr = (
			errorInfo?.code ||
			errorInfo?.message ||
			String(err)
		).toLowerCase();
		const isCommonFsError =
			errorStr.includes("eisdir") ||
			errorStr.includes("enotdir") ||
			errorStr.includes("eexist") ||
			errorStr.includes("enoent");

		if (!isCommonFsError) {
			structuredLogger.error(err);
		}

		throw err;
	}
	return result;
}

export const storageMethods: Record<string, (...args: any[]) => Promise<any>> =
	Object.fromEntries(
		[
			{ name: "getListing" },
			{ name: "createFolder" },
			{ name: "createFolders" },
			{ name: "createFolderPath" },
			{ name: "deleteFolder" },
			{ name: "deleteFolderPath" },
			{ name: "deleteFile" },
			{ name: "rename", types: ["path"] },
			{ name: "readFile" },
			{ name: "readFiles" },
			{ name: "writeFile" },
			{ name: "writeFiles" },
			{ name: "exists" },
			{ name: "exportFolder" },
			{ name: "importFolder" },
			{ name: "copyFolder", types: ["path"] },
			{ name: "copyFile", types: ["path"] },
			{ name: "getSize" },
			{ name: "resetLocalFileSystem" },
		].map((item) => {
			const { name } = item;
			if (name === "resetLocalFileSystem") {
				return [name, () => callMethod(item, "local")];
			}
			return [
				name,
				(...args) => {
					return callMethod(item, ...args);
				},
			];
		}),
	);

storageMethods.getRecursiveList = async (
	path,
	options: Record<string, any> = {},
) => {
	return callMethod({ name: "getRecursiveList" }, path, options);
};

export async function getRecursiveList(
	path: any,
	options: { strict?: boolean } = {},
) {
	const { strict = false } = options;
	try {
		const result = await storageMethods.getRecursiveList(path, options);
		if (result) {
			return result;
		}
		structuredLogger.debug(
			`[Storage] Device method returned null/undefined for: ${path}, using fallback`,
		);
	} catch (err: any) {
		if (strict) throw err;
		structuredLogger.warn(
			`[Storage] Device method failed for ${path}:`,
			err instanceof Error ? err.message : err,
		);
	}

	const listing: any = [];
	const visitedPaths = new Set<any>();
	const MAX_DEPTH = 10;

	const addListing = async (dirPath: any, depth = 0) => {
		if (depth > MAX_DEPTH) {
			const error = new Error(`Storage listing depth exceeded for: ${dirPath}`);
			if (strict) throw error;
			structuredLogger.warn(error.message);
			return;
		}

		const normalizedPath = makePath(dirPath);
		if (visitedPaths.has(normalizedPath)) {
			return;
		}
		visitedPaths.add(normalizedPath);

		let items;
		try {
			items = await limit(() => storageMethods.getListing(dirPath, options));
		} catch (error: any) {
			if (strict) throw error;
			structuredLogger.warn(
				`[Storage] Failed to list ${dirPath}:`,
				error?.message || error,
			);
			return;
		}
		if (!items || !Array.isArray(items) || items.length === 0) {
			return;
		}

		const validItems = items.filter((item) => {
			if (!item.path) return false;
			const itemPath = makePath(item.path);
			return (
				itemPath.startsWith(normalizedPath + "/") ||
				itemPath === normalizedPath + "/" + item.name
			);
		});
		if (strict && validItems.length !== items.length) {
			throw new Error(`Storage returned invalid entries for: ${dirPath}`);
		}

		if (validItems.length === 0 && items.length > 0) {
			if (strict) {
				throw new Error(`Storage returned invalid entries for: ${dirPath}`);
			}
			structuredLogger.warn(
				`[Storage] Skipping ${dirPath} - ${items.length} items don't match expected path prefix`,
			);
			return;
		}

		const isDirectoryItem = (item: any) =>
			item.type === "dir" ||
			item.stat?.type === "dir" ||
			item.name?.endsWith("/");

		const files = validItems.filter((item) => !isDirectoryItem(item));
		listing.push(...files);

		const subDirs = validItems.filter(isDirectoryItem);
		if (subDirs.length > 0) {
			await Promise.all(subDirs.map((dir) => addListing(dir.path, depth + 1)));
		}
	};

	await addListing(path, 0);
	return listing;
}
