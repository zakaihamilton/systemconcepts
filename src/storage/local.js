const FS = process.browser && require("@isomorphic-git/lightning-fs");
import { makePath, isBinaryFile } from "@util/path";

const fs = process.browser && new FS("systemconcepts-fs");

async function getListing(path, options = {}) {
    const { useCount } = options;
    let listing = [];
    let names = [];
    try {
        names = await fs.promises.readdir(path);
    }
    catch {
        return [];
    }
    for (const name of names) {
        const item = {};
        const itemPath = makePath(path, name);
        try {
            const itemStat = await fs.promises.stat(itemPath);
            const isDir = itemStat.type === "dir" || (itemStat.isDirectory && itemStat.isDirectory());
            item.type = isDir ? "dir" : "file";
            if (useCount && isDir) {
                const children = await fs.promises.readdir(itemPath);
                let count = 0;
                for (const name of children) {
                    const childStat = await fs.promises.stat(makePath(itemPath, name));
                    const childIsDir = childStat.type === "dir" || (childStat.isDirectory && childStat.isDirectory());
                    if (childIsDir) {
                        count++;
                    }
                }
                item.count = count;
            }
            Object.assign(item, itemStat);
            let mtimeMs = itemStat.mtimeMs;
            if (typeof itemStat.mtime === "object" && itemStat.mtime.getTime) {
                mtimeMs = itemStat.mtime.getTime();
            } else if (typeof itemStat.mtime === "number") {
                mtimeMs = itemStat.mtime;
            }
            item.mtimeMs = mtimeMs || 0;
            item.id = item.path = makePath("local", itemPath);
            item.name = name;
            listing.push(item);
        }
        catch (err) {
            console.error(err);
        }
    }
    return listing;
}

async function createFolder(path) {
    path = makePath(path);
    try {
        if (!(await exists(path))) {
            await fs.promises.mkdir(path);
        }
    } catch (err) {
        if (err.code !== "EEXIST" && !err.message.includes("EEXIST")) {
            throw err;
        }
    }
}

async function createFolders(prefix, folders) {
    for (const path of folders) {
        await createFolder(prefix + path);
    }
}

async function createFolderPath(path, isFolder = false) {
    path = makePath(path);
    const parts = path.split("/");
    let partIndex = parts.length - 1;
    for (; partIndex > 1; partIndex--) {
        const subPath = parts.slice(0, partIndex).join("/");
        if (await exists(subPath)) {
            break;
        }
    }
    for (partIndex++; partIndex < parts.length + (!!isFolder); partIndex++) {
        const subPath = parts.slice(0, partIndex).join("/");
        await createFolder(subPath);
    }
}

async function deleteFolder(root) {
    root = makePath(root);
    let lastError = null;

    for (let i = 0; i < 10; i++) {
        let names = [];
        try {
            names = await fs.promises.readdir(root);
        }
        catch (err) {
            if (err.code === "ENOENT") {
                return;
            }
            throw err;
        }

        if (names.length > 0) {
            for (const name of names) {
                const path = [root, name].filter(Boolean).join("/");
                try {
                    const stat = await fs.promises.stat(path);
                    const isDir = stat.type === "dir" || (stat.isDirectory && stat.isDirectory());
                    if (isDir) {
                        await deleteFolder(path);
                    }
                    else {
                        await deleteFile(path);
                    }
                }
                catch (err) {
                    if (err.code !== "ENOENT") {
                        console.error(err);
                    }
                }
            }
        }

        try {
            await fs.promises.rmdir(root);
            return;
        }
        catch (err) {
            if (err.code === "ENOENT") {
                return;
            }
            if (err.code === "ENOTEMPTY" || err.message.includes("ENOTEMPTY")) {
                try {
                    const names = await fs.promises.readdir(root);
                    if (names.length === 0) {
                        return;
                    }
                }
                catch {
                    // ignore
                }
                lastError = err;
                await new Promise(resolve => setTimeout(resolve, 100));
                continue;
            }
            throw err;
        }
    }
    if (lastError) {
        throw lastError;
    }
}

async function deleteFile(path) {
    path = makePath(path);
    await fs.promises.unlink(path);
}

async function readFile(path) {
    path = makePath(path);
    try {
        if (isBinaryFile(path)) {
            return await fs.promises.readFile(path);
        }
        return await fs.promises.readFile(path, "utf8");
    } catch (err) {
        if (err.code !== "ENOENT" && !err.message.includes("ENOENT")) {
            throw err;
        }
        return null;
    }
}

async function readFiles(prefix, files) {
    let results = {};
    for (const name of files) {
        results[name] = await readFile(prefix + name);
    }
    return results;
}

async function writeFile(path, body) {
    path = makePath(path);
    if (isBinaryFile(path)) {
        return await fs.promises.writeFile(path, body);
    }
    return await fs.promises.writeFile(path, body, "utf8");
}

async function writeFiles(prefix, files) {
    for (const path in files) {
        await writeFile(prefix + path, files[path]);
    }
}

async function exists(path) {
    path = makePath(path);
    let exists = false;
    try {
        const stat = await fs.promises.stat(path);
        exists = stat !== null;
    }
    catch {
    }
    return exists;
}

export async function clear() {
    if (typeof indexedDB === "undefined") {
        return;
    }
    return new Promise((resolve, reject) => {
        const req = indexedDB.deleteDatabase("systemconcepts-fs");
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
        req.onblocked = () => resolve();
    });
}

async function getRecursiveList(path) {
    let listing = [];
    const items = await getListing(path);
    for (const item of items) {
        if (item.type === "dir") {
            // item.path is in format "/local/sync/subfolder"
            // We need to pass just the filesystem path: "/sync/subfolder" (keep leading /)
            const pathWithoutDevice = item.path.replace(/^\/local/, "");
            const children = await getRecursiveList(pathWithoutDevice);
            listing.push(...children);
        } else {
            listing.push(item);
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
    readFile,
    readFiles,
    writeFile,
    writeFiles,
    async exists(path) {
        return exists(path);
    },
    async getSize() {
        if (typeof navigator !== "undefined" && navigator.storage && navigator.storage.estimate) {
            const estimate = await navigator.storage.estimate();
            console.log(`[Local Storage] getSize - estimate usage: ${estimate.usage}, quota: ${estimate.quota}`);
            return estimate.usage;
        }
        console.log(`[Local Storage] getSize - navigator.storage.estimate not available`);
        return 0;
    },
    getRecursiveList
};
