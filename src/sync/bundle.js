import storage from "@util/storage";
import { makePath } from "@util/path";
import pako from "pako";

/**
 * Compress JSON data to gzip format
 * @param {Object} data - JSON data to compress
 * @returns {Uint8Array} - Compressed gzip data
 */
export function compressJSON(data) {
    const jsonString = JSON.stringify(data);
    const compressed = pako.gzip(jsonString);
    return compressed;
}

/**
 * Decompress gzip data to JSON
 * @param {Uint8Array|Buffer} buffer - Compressed gzip data
 * @returns {Object} - Decompressed JSON data
 */
export function decompressJSON(buffer) {
    const decompressed = pako.ungzip(buffer, { to: 'string' });
    return JSON.parse(decompressed);
}

/**
 * Read and decompress a file (handles .gz and .json) returning the raw string content
 * @param {string} path - Path to the file
 * @returns {string|null} - Raw string content or null if file doesn't exist
 */
export async function readCompressedFileRaw(path) {
    path = makePath(path);
    try {
        // console.log("Reading file", path);
        const data = await storage.readFile(path).catch(err => {
            // treat missing file as null without logging error
            const errorStr = (err.message || String(err)).toLowerCase();
            if (errorStr.includes("no such key") || errorStr.includes("enoent")) {
                return null;
            }
            throw err;
        });

        if (data === undefined || data === null || data === "") {
            return null;
        }

        if (path.endsWith(".json")) {
            const trimmed = typeof data === "string" ? data.trim() : "";
            if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
                if (typeof data === "string") return data;
                if (Buffer.isBuffer(data)) return data.toString('utf8');
                return JSON.stringify(data);
            }
        }

        let buffer;
        if (typeof data === 'string') {
            try {
                // If it looks like JSON, return it directly
                // This mimics the behavior of trying JSON.parse first
                const trimmed = data.trim();
                if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
                    return data;
                }

                // Debug logging for invalid data
                if (!data || data.length === 0) {
                    console.error(`[Bundle] Empty data string for ${path}`);
                    return null;
                }
                buffer = Buffer.from(data, 'base64');
            } catch (e) {
                console.error(`[Bundle] Failed to decode base64 for ${path}`, e);
                return null;
            }
        } else if (Buffer.isBuffer(data)) {
            buffer = data;
        } else if (data instanceof Uint8Array) {
            buffer = Buffer.from(data);
        } else {
            console.error(`[Bundle] Unexpected data type for ${path}:`, typeof data, data);
            return null;
        }

        try {
            return pako.ungzip(buffer, { to: 'string' });
        } catch (e) {
            try {
                const text = new TextDecoder("utf-8").decode(buffer);
                return text;
            } catch {
                console.error(`[Bundle] Failed to decompress ${path}: ${e.message || e}`);
                return null;
            }
        }
    } catch (err) {
        // Only log errors that aren't "Not Found"
        console.error(`[Bundle] Error reading file ${path}:`, err);
        return null;
    }
}

/**
 * Read and decompress a file (handles .gz and .json)
 * @param {string} path - Path to the file
 * @returns {Object|null} - Parsed JSON data or null if file doesn't exist
 */
export async function readCompressedFile(path) {
    const content = await readCompressedFileRaw(path);
    if (content === null) return null;
    try {
        return JSON.parse(content);
    } catch (e) {
        console.error(`[Bundle] Failed to parse JSON for ${path}:`, e.message);
        return null;
    }
}

/**
 * Compress and write JSON data to a file (handles .gz and .json)
 * @param {string} path - Path to write the file
 * @param {Object} data - JSON data to write
 */
export async function writeCompressedFile(path, data, folderCache = null) {
    path = makePath(path);
    try {
        const folder = path.substring(0, path.lastIndexOf("/"));
        if (!folderCache || !folderCache.has(folder)) {
            await storage.createFolderPath(path);
            if (folderCache) {
                folderCache.add(folder);
            }
        }

        if (data === undefined || data === null) {
            console.error(`[Bundle] Attempted to write ${data} to ${path}`);
            throw new Error(`Attempted to write ${data} to ${path}`);
        }

        if (path.endsWith(".json")) {
            let jsonString = data;
            if (typeof data !== "string") {
                jsonString = JSON.stringify(data, null, 4);
            }
            await storage.writeFile(path, jsonString);
        } else {
            let buffer;
            if (Buffer.isBuffer(data) || data instanceof Uint8Array) {
                buffer = Buffer.from(pako.gzip(data));
            } else {
                const compressed = compressJSON(data);
                buffer = Buffer.from(compressed);
            }

            // Both local and AWS need base64 encoding for .gz files
            const base64 = buffer.toString('base64');
            await storage.writeFile(path, base64);
        }
    } catch (err) {
        console.error(`[Bundle] Error writing file ${path}:`, err);
        throw err;
    }
}
