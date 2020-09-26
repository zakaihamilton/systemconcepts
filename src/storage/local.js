import FS from '@isomorphic-git/lightning-fs';
import { makePath } from "@/util/path";

const fs = new FS("systemconcepts-fs");

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
            item.id = item.path = makePath("local", itemPath);
            item.name = name;
            item.folder = makePath("local", path);
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
    if (!await exists(path)) {
        await fs.promises.mkdir(path);
    }
}

async function createFolders(path) {
    path = makePath(path);
    const parts = path.split("/");
    let partIndex = parts.length - 1;
    for (; partIndex > 1; partIndex--) {
        const subPath = parts.slice(0, partIndex).join("/");
        if (await exists(subPath)) {
            break;
        }
    }
    for (partIndex++; partIndex < parts.length; partIndex++) {
        const subPath = parts.slice(0, partIndex).join("/");
        createFolder(subPath);
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

async function writeFile(path, body) {
    path = makePath(path);
    return await fs.promises.writeFile(path, body, "utf8");
}

async function exists(path) {
    path = makePath(path);
    let exists = false;
    try {
        const stat = await fs.promises.stat(path);
        exists = stat !== null;
    }
    catch (err) { }
    return exists;
}

export default {
    getListing,
    createFolder,
    createFolders,
    deleteFolder,
    deleteFile,
    readFile,
    writeFile,
    exists
};
