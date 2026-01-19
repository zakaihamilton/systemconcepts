import { fetchJSON, fetchText, fetchBlob } from "@util/fetch";
import { makePath } from "@util/path";
import { isBinaryFile } from "@util/path";
import { binaryToString } from "@util/binary";

const fsEndPoint = "/api/aws";

async function getListing(path, options = {}) {
    path = makePath(path);
    const { useCount } = options;
    const listing = [];
    const encodedPath = encodeURIComponent(path.slice(1));
    console.log(`[AWS Storage] getListing - Original path: ${path}, Encoded: ${encodedPath}`);
    const items = await fetchJSON(fsEndPoint, {
        method: "GET",
        cache: "no-store",
        headers: {
            type: "dir",
            path: encodedPath
        }
    });
    console.log(`[AWS Storage] getListing - Received ${items?.length || 0} items for path: ${path}`);
    for (const item of items) {
        const { name, stat = {} } = item;
        const itemPath = makePath(path, name);
        if (useCount && stat.type === "dir") {
            const children = await fetchJSON(fsEndPoint, {
                method: "GET",
                cache: "no-store",
                headers: {
                    type: "dir",
                    path: encodeURIComponent(path.slice(1))
                }
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
    console.log(`[AWS Storage] getListing - Returning ${listing.length} items for path: ${path}`);
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
        if (item.stat.type === "dir") {
            await deleteFolder(path);
        }
        else {
            await deleteFile(path);
        }
    }
    await fetchJSON(fsEndPoint, {
        method: "DELETE",
        cache: "no-store",
        headers: {
            path: encodeURIComponent(root.slice(1))
        }
    });
}

async function deleteFile(path) {
    path = makePath(path);
    await fetchJSON(fsEndPoint, {
        method: "DELETE",
        cache: "no-store",
        headers: {
            path: encodeURIComponent(path.slice(1))
        }
    });
}

async function readFile(path) {
    path = makePath(path);
    const binary = isBinaryFile(path);
    let body = null;
    if (binary) {
        body = await fetchBlob(fsEndPoint, {
            method: "GET",
            cache: "no-store",
            headers: {
                binary: true,
                path: encodeURIComponent(path.slice(1))
            }
        });
        // Check if we accidentally received a directory listing
        if (Array.isArray(body)) {
            throw new Error(`Cannot read directory as file: ${path}`);
        }
        body = binaryToString(body);
        return body;
    }
    else {
        body = await fetchText(fsEndPoint, {
            method: "GET",
            cache: "no-store",
            headers: {
                type: "file",
                path: encodeURIComponent(path.slice(1))
            }
        });
        // Check if we accidentally received a directory listing (JSON array)
        try {
            const parsed = JSON.parse(body);
            if (Array.isArray(parsed)) {
                throw new Error(`Cannot read directory as file: ${path}`);
            }
        } catch (e) {
            // Not JSON or not an array, which is expected for normal files
            if (e.message && e.message.includes('Cannot read directory')) {
                throw e;
            }
        }
    }
    return body;
}

async function readFiles(prefix, files) {
    const results = {};
    // Ensure prefix ends with / for proper path construction
    if (!prefix.endsWith('/')) {
        prefix = prefix + '/';
    }
    // Read files in parallel with a concurrency limit
    const limit = (await import("p-limit")).default(10);
    await Promise.all(files.map(name => limit(async () => {
        try {
            const path = prefix + name;

            const content = await readFile(path);
            if (content !== null && content !== undefined) {
                results[name] = content;
            }
        } catch (err) {
            // Silently skip files that don't exist (NoSuchKey is expected for .tags files)
            // Only log unexpected errors
            if (err && !err.message?.includes('NoSuchKey') && !err.message?.includes('404')) {
                console.warn(`Failed to read file ${prefix}${name}:`, err.message || err);
            }
        }
    })));
    return results;
}

async function writeFile(path, body) {
    path = makePath(path);
    await fetchJSON(fsEndPoint, {
        method: "PUT",
        cache: "no-store",
        body: JSON.stringify([{
            path,
            body
        }])
    });
}

async function writeFiles(prefix, files) {
    const maxBytes = 4000 * 1000;
    let batch = [];
    for (const name in files) {
        const path = prefix + name;
        const body = files[name] || "";
        if (JSON.stringify(batch).length + body.length > maxBytes) {
            await fetchJSON(fsEndPoint, {
                method: "PUT",
                cache: "no-store",
                body: JSON.stringify(batch)
            });
            batch = [];
        }
        batch.push({
            path,
            body
        });
    }
    if (batch.length) {
        await fetchJSON(fsEndPoint, {
            method: "PUT",
            cache: "no-store",
            body: JSON.stringify(batch)
        });
    }
}

async function getRecursiveList(path) {
    path = makePath(path);

    // First check if the base path exists
    if (!(await exists(path))) {
        console.log(`[AWS Storage] Path does not exist: ${path}`);
        return [];
    }

    const listing = [];
    const visitedPaths = new Set();

    const MAX_DEPTH = 10;

    const addListing = async (dirPath, depth = 0) => {
        if (depth > MAX_DEPTH) {
            console.warn(`[AWS Storage] Max depth exceeded for: ${dirPath}`);
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
                    console.warn(`[AWS Storage] Skipping invalid item: ${item.path} (expected prefix: ${expectedPrefix})`);
                    continue;
                }

                const isDir = item.type === "dir" || item.stat?.type === "dir" || item.name?.endsWith("/");
                if (isDir) {
                    // item.path has "aws/" prefix from getListing, strip it for recursive call
                    const itemPathWithoutDevice = item.path.replace(/^\/aws\//, "/").replace(/^aws\//, "");
                    await addListing(itemPathWithoutDevice, depth + 1);
                } else {
                    listing.push(item);
                }
            }
        } catch (err) {
            console.warn(`[AWS Storage] Failed to list ${dirPath}:`, err.message || err);
        }
    };

    await addListing(path);
    return listing;
}

async function exists(path) {
    path = makePath(path);
    let exists = false;
    try {
        const item = await fetchJSON(fsEndPoint + "?path=" + encodeURIComponent(path.slice(1)), {
            method: "GET",
            cache: "no-store",
            headers: {
                path: encodeURIComponent(path.slice(1)),
                exists: true
            },
        });
        // If we receive an array, it means we got a directory listing instead of file metadata
        // This happens when the file doesn't exist but a similarly-named directory does
        if (Array.isArray(item)) {
            console.log(`[AWS Storage] Path check returned directory listing for ${path}, treating as non-existent file`);
            exists = false;
        } else {
            exists = item && item.name;
        }
        if (!exists) {
            console.log(`[AWS Storage] Path check returned false for ${path}`, item);
        }
    }
    catch (err) {
        console.error(`[AWS Storage] Path check error for ${path}:`, err);
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
    exists
};
