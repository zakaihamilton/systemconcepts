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
 * Read and decompress a file (handles .gz and .json)
 * @param {string} path - Path to the file
 * @returns {Object|null} - Parsed JSON data or null if file doesn't exist
 */
export async function readCompressedFile(path) {
    path = makePath(path);
    try {
        if (!await storage.exists(path)) {
            return null;
        }
        const data = await storage.readFile(path);
        if (data === undefined || data === null || data === "") {
            return null;
        }

        if (path.endsWith(".json")) {
            return typeof data === "string" ? JSON.parse(data) : data;
        }

        if (typeof data === "string") {
            try {
                // Try parsing as raw JSON first
                return JSON.parse(data);
            } catch (e) {
                // Not raw JSON, continue with base64/gzip
            }
        }

        // All storage returns base64 string (both local and AWS)
        let buffer;
        if (typeof data === 'string') {
            try {
                buffer = Buffer.from(data, 'base64');
            } catch (e) {
                console.error(`[Bundle] Failed to decode base64 for ${path}`);
                return null;
            }
        } else if (Buffer.isBuffer(data)) {
            buffer = data;
        } else if (data instanceof Uint8Array) {
            buffer = Buffer.from(data);
        } else {
            console.error(`[Bundle] Unexpected data type for ${path}:`, typeof data);
            return null;
        }

        try {
            return decompressJSON(buffer);
        } catch (e) {
            console.error(`[Bundle] Failed to decompress ${path}:`, e.message);
            return null;
        }
    } catch (err) {
        console.error(`[Bundle] Error reading file ${path}:`, err);
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

        if (path.endsWith(".json")) {
            const jsonString = JSON.stringify(data, null, 4);
            await storage.writeFile(path, jsonString);
            return;
        }

        const compressed = compressJSON(data);
        const buffer = Buffer.from(compressed);

        // Both local and AWS need base64 encoding for .gz files
        const base64 = buffer.toString('base64');
        await storage.writeFile(path, base64);
    } catch (err) {
        console.error(`[Bundle] Error writing file ${path}:`, err);
        throw err;
    }
}
