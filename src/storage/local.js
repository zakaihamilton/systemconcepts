const FS = process.browser && require("@isomorphic-git/lightning-fs");
import { makePath } from "@util/path";

const fs = process.browser && new FS("systemconcepts-fs");

async function getListing(path, options = {}) {
    const { useCount } = options;
    let listing = [];
    const names = await fs.promises.readdir(path);
    for (const name of names) {
        const item = {};
        const itemPath = makePath(path, name);
        try {
            const itemStat = await fs.promises.stat(itemPath);
            if (useCount && itemStat.type === "dir") {
                const children = await fs.promises.readdir(itemPath);
                let count = 0;
                for (const name of children) {
                    const itemStat = await fs.promises.stat(makePath(itemPath, name));
                    if (itemStat.type === "dir") {
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
    if (!(await exists(path))) {
        await fs.promises.mkdir(path);
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
    const names = await fs.promises.readdir(root);
    for (const name of names) {
        const path = [root, name].filter(Boolean).join("/");
        const stat = await fs.promises.stat(path);
        if (stat.type === "dir") {
            await deleteFolder(path);
        }
        else {
            await deleteFile(path);
        }
    }
    await fs.promises.rmdir(root);
}

async function deleteFile(path) {
    path = makePath(path);
    await fs.promises.unlink(path);
}

async function readFile(path) {
    path = makePath(path);
    return await fs.promises.readFile(path, "utf8");
}

async function readFiles(prefix, files) {
    let results = {};
    for (const name of files) {
        results[name] = await readFile(prefix + name);
    }
    return files;
}

async function writeFile(path, body) {
    path = makePath(path);
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
    catch (err) {
    }
    return exists;
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
    exists
};
