import FS from '@isomorphic-git/lightning-fs';

const fs = new FS("systemconcepts-fs");

async function getListing(path) {
    let listing = [];
    const names = await fs.promises.readdir(path);
    for (const name of names) {
        const item = {};
        const itemPath = (path.endsWith("/") ? path : path + "/") + name;
        try {
            const itemStat = await fs.promises.stat(itemPath);
            if (itemStat.type === "dir") {
                const children = await fs.promises.readdir(itemPath);
                let count = 0;
                for (const name of children) {
                    const itemStat = await fs.promises.stat(itemPath + "/" + name);
                    if (itemStat.type === "dir") {
                        count++;
                    }
                }
                item.count = count;
            }
            Object.assign(item, itemStat);
            item.id = item.path = "local" + itemPath;
            item.name = name;
            item.folder = "local" + path;
            listing.push(item);
        }
        catch (err) {
            console.error(err);
        }
    }
    return listing;
}

async function createFolder(path) {
    if (!await exists(path)) {
        await fs.promises.mkdir(path);
    }
}

async function createFolders(path) {
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
    await fs.promises.unlink(path);
}

async function rename(from, to) {
    await fs.promises.rename(from, to);
}

async function readFile(path, encoding = "utf8") {
    return await fs.promises.readFile(path, encoding);
}

async function writeFile(path, body, encoding = "utf8") {
    return await fs.promises.writeFile(path, body, encoding);
}

async function exists(path) {
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
    rename,
    readFile,
    writeFile,
    exists
};
