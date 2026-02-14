import { fetchJSON, fetchText, fetchBlob } from "@util/fetch";
import { makePath } from "@util/path";
import { isBinaryFile } from "@util/path";
import { binaryToString } from "@util/binary";

const fsEndPoint = "/api/wasabi";

async function getListing(path) {
    path = makePath(path);
    const listing = [];
    const encodedPath = encodeURIComponent(path);
    const url = `${fsEndPoint}?path=${encodedPath}&type=dir&t=${Date.now()}`;
    const items = await fetchJSON(url, {
        method: "GET",
        cache: "no-store"
    });
    for (const item of items) {
        const { name, stat = {} } = item;
        const itemPath = makePath(path, name);
        Object.assign(item, stat);
        item.id = item.path = makePath("wasabi", itemPath);
        item.name = name;
        listing.push(item);
    }
    return listing;
}

async function createFolder() {
}

async function createFolders() {
}

async function createFolderPath() {
}

async function deleteFolder() {
}

async function deleteFile() {
}

async function readFile(path) {
    path = makePath(path);
    const binary = isBinaryFile(path);
    let body = null;
    const encodedPath = encodeURIComponent(path);
    if (binary) {
        body = await fetchBlob(`${fsEndPoint}?path=${encodedPath}&binary=true`, {
            method: "GET",
            cache: "no-store"
        });
        body = binaryToString(body);
        return body;
    }
    else {
        body = await fetchText(`${fsEndPoint}?path=${encodedPath}&type=file`, {
            method: "GET",
            cache: "no-store"
        });
    }
    return body;
}

async function readFiles() {
}

async function writeFile() {
}

async function writeFiles() {
}

async function getRecursiveList(path) {
    path = makePath(path);
    const listing = [];
    const addListing = async (dirPath) => {
        try {
            const items = await getListing(dirPath);
            for (const item of items) {
                const isDir = item.type === "dir" || item.stat?.type === "dir" || item.name?.endsWith("/");
                if (isDir) {
                    const itemPathWithoutDevice = item.path.replace(/^\/wasabi\//, "/").replace(/^wasabi\//, "");
                    await addListing(itemPathWithoutDevice);
                } else {
                    listing.push(item);
                }
            }
        } catch (err) {
            console.warn(`[Wasabi Storage] Failed to list ${dirPath}:`, err.message || err);
        }
    };
    await addListing(path);
    return listing;
}

async function exists(path) {
    path = makePath(path);
    let exists = false;
    try {
        const item = await fetchJSON(fsEndPoint + "?path=" + encodeURIComponent(path) + "&exists=true&t=" + Date.now(), {
            method: "GET",
            cache: "no-store"
        });
        if (Array.isArray(item)) {
            exists = false;
        } else {
            if (item && (item.type === "dir" || item.type === "application/x-directory")) {
                exists = false;
            } else {
                exists = item && item.name;
            }
        }
    }
    catch (err) {
        console.error(`[Wasabi Storage] Path check error for ${path}:`, err);
    }
    return exists;
}

export default {
    getListing,
    getRecursiveList,
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
