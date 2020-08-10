import FS from '@isomorphic-git/lightning-fs';

const fs = new FS("systemconcepts-fs");

async function getListing(path) {
    let listing = [];
    const stat = await fs.promises.stat(path);
    if (stat.isDirectory) {
        const names = await fs.promises.readdir(path);
        for (const name of names) {
            const item = {};
            const filePath = [path, name].filter(Boolean).join("/");
            try {
                const fileStat = await fs.promises.stat(filePath);
                Object.assign(item, fileStat);
                item.path = "local" + filePath;
                item.name = name;
                item.folder = "local/" + path;
                listing.push(item);
            }
            catch (err) {
                console.error(err);
            }
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
    if (from !== to) {
        await fs.promises.rename(from, to);
    }
}

async function readFile(path, encoding = "utf8") {
    return await fs.promises.readFile(path, encoding);
}

async function writeFile(path, body, encoding = "utf8") {
    return await fs.promises.writeFile(path, body, encoding);
}

export default {
    getListing,
    createFolder,
    createFile,
    deleteFolder,
    deleteFile,
    rename,
    readFile,
    writeFile
};