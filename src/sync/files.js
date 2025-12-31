import storage from "@util/storage";
import { makePath } from "@util/path";
import { readCompressedFile, writeCompressedFile } from "./bundle";
import { lockMutex } from "./mutex";

const BASE_PATH = "local/sync";

/**
 * Read file from local storage
 * @param {string} fileName - Relative path not including the base folder
 * @param {Object} [defaultValue={}] - Default value if file doesn't exist
 * @returns {Promise<Object>}
 */
export async function readFile(fileName, defaultValue = {}) {
    const filePath = makePath(BASE_PATH, fileName);
    const unlock = await lockMutex({ id: filePath });
    try {
        if (!await storage.exists(filePath)) {
            return defaultValue;
        }

        const data = await readCompressedFile(filePath);
        return data || defaultValue;
    } catch (err) {
        console.error(`[Files] Error reading ${fileName}:`, err);
        return defaultValue;
    } finally {
        unlock();
    }
}

/**
 * Write file to local storage
 * @param {string} fileName - Relative path not including the base folder
 * @param {Object} data - Content to write
 */
export async function writeFile(fileName, data) {
    const filePath = makePath(BASE_PATH, fileName);
    const unlock = await lockMutex({ id: filePath });
    try {
        await writeCompressedFile(filePath, data);
    } catch (err) {
        console.error(`[Files] Error writing ${fileName}:`, err);
        throw err;
    } finally {
        unlock();
    }
}
