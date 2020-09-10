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

async function importFolder(path, data) {
    const fromData = async (root, data) => {
        await createFolder(root);
        const keys = Object.keys(data);
        for (const key of keys) {
            const path = root + "/" + key;
            const value = data[key];
            if (typeof value === "object") {
                await createFolder(path);
                if (Array.isArray(value)) {
                    for (const item of value) {
                        if (typeof item === "object") {
                            const name = item.id || item.name;
                            await fromData(path + "/" + name, item);
                        }
                    }
                }
                else {
                    await fromData(path, value);
                }
            }
            else if (typeof value === "string") {
                await fs.promises.writeFile(path, value, "utf8");
            }
        }
    };
    await fromData(path, data);
}

async function copyFolder(from, to) {
    const names = await fs.promises.readdir(from);
    await createFolder(to);
    for (const name of names) {
        try {
            const fromPath = [from, name].filter(Boolean).join("/");
            const toPath = [to, name].filter(Boolean).join("/");
            const itemStat = await fs.promises.stat(itemPath);
            if (itemStat.isDirectory()) {
                await copyFolder(fromPath, toPath);
            }
            else {
                await copyFile(fromPath, toPath);
            }
        }
        catch (err) {
            console.error(err);
        }
    }
}

async function copyFile(from, to) {
    const data = await readFile(from, "utf8");
    await writeFile(to, data, "utf8");
}

export default {
    getListing,
    createFolder,
    deleteFolder,
    deleteFile,
    rename,
    readFile,
    writeFile,
    exists,
    exportFolder,
    importFolder,
    copyFolder,
    copyFile
};