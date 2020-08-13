import FS from '@isomorphic-git/lightning-fs';

const fs = new FS("systemconcepts-fs");

async function getListing(path) {
    let listing = [];
    const names = await fs.promises.readdir(path);
    for (const name of names) {
        const item = {};
        const itemPath = [path, name].filter(Boolean).join("/");
        try {
            const itemStat = await fs.promises.stat(itemPath);
            Object.assign(item, itemStat);
            item.path = "local" + itemPath;
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
    await fs.promises.mkdir(path);
}

async function createFile(path) {
    await fs.promises.writeFile(path, "", "utf8");
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

async function exportFile(path) {
    const data = await fs.promises.readFile(path, "utf8");
    return data;
}

async function exportFolder(path) {
    const toData = async path => {
        const data = {};
        const names = await fs.promises.readdir(path);
        for (const name of names) {
            try {
                const itemPath = [path, name].filter(Boolean).join("/");
                const itemStat = await fs.promises.stat(itemPath);
                if (itemStat.isDirectory()) {
                    const result = await toData(itemPath);
                    data[name] = result;
                }
                else {
                    data[name] = await fs.promises.readFile(itemPath, "utf8");
                }
            }
            catch (err) {
                console.error(err);
            }
        }
        return data;
    }
    const data = await toData(path);
    return data;
}

export default {
    getListing,
    createFolder,
    createFile,
    deleteFolder,
    deleteFile,
    rename,
    readFile,
    writeFile,
    exists,
    exportFile,
    exportFolder
};