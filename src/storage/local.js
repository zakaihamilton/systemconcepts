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
                item.filePath = "local" + filePath;
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

async function deleteFolder(path) {
    await fs.promises.rmdir(path);
}

async function deleteFile(path) {
    await fs.promises.unlink(path);
}

export default {
    getListing,
    createFolder,
    createFile,
    deleteFolder,
    deleteFile
};