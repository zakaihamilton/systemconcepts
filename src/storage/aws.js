import { fetchJSON, requireRelogin } from "@util/api/fetch";
import { logger as structuredLogger } from "@util/api/logger";
import { binaryToString } from "@util/data/binary";
import { isBinaryFile, makePath } from "@util/data/path";
import pLimit from "p-limit";

const fsEndPoint = "/api/aws";

async function getListing(path, options = {}) {
	path = makePath(path)
		.replace(/^\/aws\//, "/")
		.replace(/^aws\//, "");
	const { useCount } = options;
	const listing = [];
	const encodedPath = encodeURIComponent(path.replace(/^\//, ""));
	const url = `${fsEndPoint}?path=${encodedPath}&type=dir&t=${Date.now()}`;
	const items = await fetchJSON(url, {
		method: "GET",
		cache: "no-store",
	});
	for (const item of items) {
		const { name, stat = {} } = item;
		const itemPath = makePath(path, name);
		if (useCount && stat.type === "dir") {
			const url = `${fsEndPoint}?path=${encodeURIComponent(path.replace(/^\//, ""))}&type=dir&t=${Date.now()}`;
			const children = await fetchJSON(url, {
				method: "GET",
				cache: "no-store",
			});
			let count = 0;
			for (const item of children) {
				if (item.stat.type === "dir") {
					count++;
				}
			}
			item.count = count;
		}
		Object.assign(item, stat);
		item.id = item.path = makePath("aws", itemPath);
		item.name = name;
		listing.push(item);
	}
	return listing;
}

async function createFolder() {
	/* ignore on aws */
}

async function createFolders() {
	/* ignore on aws */
}

async function createFolderPath() {
	/* ignore on aws */
}

async function deleteFolder(root) {
	root = makePath(root);
	const listing = await getListing(root);
	for (const item of listing) {
		const path = [root, item.name].filter(Boolean).join("/");
		if (item.stat?.type === "dir" || item.type === "dir") {
			await deleteFolder(path);
		} else {
			await deleteFile(path);
		}
	}
	const encodedPath = encodeURIComponent(root.replace(/^\//, ""));
	await fetchJSON(`${fsEndPoint}?path=${encodedPath}`, {
		method: "DELETE",
		cache: "no-store",
	});
}

async function deleteFile(path) {
	path = makePath(path)
		.replace(/^\/aws\//, "/")
		.replace(/^aws\//, "");
	const encodedPath = encodeURIComponent(path.replace(/^\//, ""));
	await fetchJSON(`${fsEndPoint}?path=${encodedPath}&t=${Date.now()}`, {
		method: "DELETE",
		cache: "no-store",
	});
}

async function readFile(path) {
	path = makePath(path)
		.replace(/^\/aws\//, "/")
		.replace(/^aws\//, "");
	const binary = isBinaryFile(path);
	const encodedPath = encodeURIComponent(path.replace(/^\//, ""));
	const url = `${fsEndPoint}?path=${encodedPath}`;

	const res = await fetch(url, { method: "GET", cache: "no-store" });

	if (requireRelogin(res)) {
		throw new Error("AUTHENTICATION_REQUIRED");
	}
	if (!res.ok) {
		throw new Error(`Failed to fetch file: ${res.status}`);
	}

	const contentType = res.headers.get("content-type") || "";
	if (contentType.includes("application/json")) {
		const text = await res.text();
		try {
			const parsed = JSON.parse(text);
			if (parsed?.signedUrl) {
				const signedRes = await fetch(parsed.signedUrl);
				if (!signedRes.ok) {
					throw new Error(
						`Failed to fetch from signed URL: ${signedRes.status}`,
					);
				}
				if (binary) {
					const blob = await signedRes.blob();
					return binaryToString(blob);
				}
				return await signedRes.text();
			}
			if (Array.isArray(parsed)) {
				throw new Error(`Cannot read directory as file: ${path}`);
			}
		} catch (e) {
			if (e.message?.startsWith("Cannot read directory")) throw e;
		}
	}

	if (binary) {
		const blob = await res.blob();
		return binaryToString(blob);
	}
	return await res.text();
}

async function readFiles(prefix, files) {
	const results = {};
	// Ensure prefix ends with / for proper path construction
	if (!prefix.endsWith("/")) {
		prefix = prefix + "/";
	}
	// Read files in parallel with a concurrency limit
	const limit = pLimit(10);
	await Promise.all(
		files.map((name) =>
			limit(async () => {
				try {
					const path = prefix + name;

					const content = await readFile(path);
					if (content !== null && content !== undefined) {
						results[name] = content;
					}
				} catch (err) {
					if (err?.message === "AUTHENTICATION_REQUIRED") {
						throw err;
					}
					// Silently skip files that don't exist (NoSuchKey is expected for .tags files)
					// Only log unexpected errors
					if (
						err &&
						!err.message?.includes("NoSuchKey") &&
						!err.message?.includes("404")
					) {
						structuredLogger.warn(
							`Failed to read file ${prefix}${name}:`,
							err.message || err,
						);
					}
				}
			}),
		),
	);
	return results;
}

async function writeFile(path, body) {
	path = makePath(path)
		.replace(/^\/aws\//, "/")
		.replace(/^aws\//, "");

	try {
		const isGzip = path.endsWith(".gz");
		const contentType = isGzip
			? "application/gzip"
			: isBinaryFile(path)
				? "application/octet-stream"
				: "application/json";

		// 1. Get Signed URL from our API
		const { url, err } = await fetchJSON(
			`/api/aws_upload?path=${encodeURIComponent(path)}&contentType=${encodeURIComponent(contentType)}`,
		);
		if (err) throw new Error(err);
		if (!url) throw new Error("Failed to get signed upload URL");

		// 2. Prepare the body.
		// If it's a .gz file, it might have been base64 encoded by bundle.js for the old proxy.
		// We decode it back to binary for direct S3 upload to be more efficient.
		let bodyToUpload = body;

		if (typeof body === "string" && isGzip) {
			try {
				// Check if it's base64
				if (!body.startsWith("{") && !body.startsWith("[")) {
					const binaryString = atob(body);
					const bytes = new Uint8Array(binaryString.length);
					for (let i = 0; i < binaryString.length; i++) {
						bytes[i] = binaryString.charCodeAt(i);
					}
					bodyToUpload = bytes;
				}
			} catch {
				// If atob fails, it wasn't base64, use as-is
			}
		}

		// 3. Upload directly to DigitalOcean/S3
		const response = await fetch(url, {
			method: "PUT",
			body: bodyToUpload,
			headers: {
				"Content-Type": isGzip
					? "application/gzip"
					: isBinaryFile(path)
						? "application/octet-stream"
						: "application/json",
			},
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(
				`Direct upload failed (${response.status}): ${errorText}`,
			);
		}

		structuredLogger.debug(
			`[AWS Storage] Successfully uploaded ${path} directly to S3`,
		);
	} catch (err) {
		structuredLogger.error(
			`[AWS Storage] Direct upload failed for ${path}, falling back to proxy:`,
			err,
		);

		// Fallback to the old proxy method if direct upload fails (e.g., signed URL API issues)
		let bodyToSend = body;
		if (
			isBinaryFile(path) &&
			(body instanceof Uint8Array || ArrayBuffer.isView(body))
		) {
			bodyToSend = await binaryToString(new Blob([body]));
		}

		await fetchJSON(fsEndPoint, {
			method: "PUT",
			cache: "no-store",
			body: JSON.stringify([
				{
					path,
					body: bodyToSend,
				},
			]),
		});
	}
}

async function writeFiles(prefix, files) {
	// Read files in parallel with a concurrency limit
	const limit = pLimit(5);
	await Promise.all(
		Object.keys(files).map((name) =>
			limit(async () => {
				const path = prefix + name;
				const body = files[name] || "";
				await writeFile(path, body);
			}),
		),
	);
}

async function getRecursiveList(path) {
	path = makePath(path);

	const listing = [];
	const visitedPaths = new Set();

	const MAX_DEPTH = 10;

	const addListing = async (dirPath, depth = 0) => {
		if (depth > MAX_DEPTH) {
			structuredLogger.warn(`[AWS Storage] Max depth exceeded for: ${dirPath}`);
			return;
		}

		// Normalize the path for consistent comparison
		const normalizedDirPath = makePath(dirPath);

		// Prevent infinite loops and duplicate visits
		if (visitedPaths.has(normalizedDirPath)) {
			return;
		}
		visitedPaths.add(normalizedDirPath);

		try {
			const items = await getListing(dirPath);
			if (!items || !Array.isArray(items) || items.length === 0) {
				return;
			}

			// Expected path prefix for items (with aws device prefix)
			const expectedPrefix = makePath("aws", normalizedDirPath);

			for (const item of items) {
				// Validate item path belongs to this directory
				if (!item.path || !item.path.startsWith(expectedPrefix)) {
					structuredLogger.warn(
						`[AWS Storage] Skipping invalid item: ${item.path} (expected prefix: ${expectedPrefix})`,
					);
					continue;
				}

				const isDir =
					item.type === "dir" ||
					item.stat?.type === "dir" ||
					item.name?.endsWith("/");
				if (isDir) {
					// item.path has "aws/" prefix from getListing, strip it for recursive call
					const itemPathWithoutDevice = item.path
						.replace(/^\/aws\//, "/")
						.replace(/^aws\//, "");
					await addListing(itemPathWithoutDevice, depth + 1);
				} else {
					listing.push(item);
				}
			}
		} catch (err) {
			structuredLogger.warn(
				`[AWS Storage] Failed to list ${dirPath}:`,
				err.message || err,
			);
		}
	};

	await addListing(path);
	return listing;
}

async function exists(path) {
	path = makePath(path)
		.replace(/^\/aws\//, "/")
		.replace(/^aws\//, "");
	let exists = false;
	try {
		const item = await fetchJSON(
			fsEndPoint +
				"?path=" +
				encodeURIComponent(path.replace(/^\//, "")) +
				"&exists=true&t=" +
				Date.now(),
			{
				method: "GET",
				cache: "no-store",
			},
		);
		// If we receive an array, it means we got a directory listing instead of file metadata
		// This happens when the file doesn't exist but a similarly-named directory does
		if (Array.isArray(item)) {
			structuredLogger.debug(
				`[AWS Storage] Path check returned directory listing for ${path}, treating as non-existent file`,
			);
			exists = false;
		} else {
			// If it's explicitly identified as a directory, say it doesn't exist (as a file)
			if (
				item &&
				(item.type === "dir" || item.type === "application/x-directory")
			) {
				exists = false;
			} else {
				exists = item && item.name;
			}
		}
		if (!exists) {
			structuredLogger.debug(
				`[AWS Storage] Path check returned false for ${path}`,
				item,
			);
		}
	} catch (err) {
		structuredLogger.error(`[AWS Storage] Path check error for ${path}:`, err);
	}
	return exists;
}

export default {
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
};
