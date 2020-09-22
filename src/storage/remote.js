import { fetchJSON } from "@/util/fetch";
import { makePath } from "@/util/path";
import { encode, decode } from "base64-arraybuffer-es6";

export default function remoteStorage({ fsEndPoint, deviceId }) {

    async function getListing(path, options = {}) {
        path = makePath(path);
        const { useCount } = options;
        const listing = [];
        const items = await fetchJSON(fsEndPoint, {
            method: "GET",
            headers: {
                query: encodeURIComponent(JSON.stringify({ folder: path })),
                fields: encodeURIComponent(JSON.stringify({ folder: true, name: true, stat: true })),
            }
        });
        for (const item of items) {
            const { name, stat, deleted } = item;
            const itemPath = makePath(path, name);
            if (deleted) {
                continue;
            }
            if (useCount && stat.type === "dir") {
                const children = await fetchJSON(fsEndPoint, {
                    method: "GET",
                    headers: {
                        query: encodeURIComponent(JSON.stringify({ folder: itemPath })),
                        fields: encodeURIComponent(JSON.stringify({ folder: true, name: true, stat: true })),
                    }
                });
                let count = 0;
                for (const item of children) {
                    if (item.stat.type === "dir") {
                        count++;
                    }
                }
                item.count = count;
            }
            Object.assign(item, stat);
            item.id = item.path = makePath(deviceId, itemPath);
            item.name = name;
            item.folder = makePath(deviceId, path);
            listing.push(item);
        }
        return listing;
    }

    async function createFolder(path) {
        path = makePath(path);
        if (!await exists(path)) {
            await fetchJSON(fsEndPoint, {
                method: "PUT",
                body: JSON.stringify([{
                    id: path,
                    name: path.split("/").filter(Boolean).pop(),
                    folder: "/" + path.split("/").filter(Boolean).slice(0, -1).join("/"),
                    stat: {
                        type: "dir",
                        mtimeMs: new Date().getTime()
                    }
                }])
            });
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
            await createFolder(subPath);
        }
    }

    async function deleteFolder(root) {
        root = makePath(root);
        const listing = await getListing(root);
        for (const item of listing) {
            const path = [root, item.name].filter(Boolean).join("/");
            if (item.stat.type === "dir") {
                await deleteFolder(path);
            }
            else {
                await deleteFile(path);
            }
        }
        await fetchJSON(fsEndPoint, {
            method: "PUT",
            body: JSON.stringify([{
                id: root,
                name: root.split("/").filter(Boolean).pop(),
                folder: "/" + root.split("/").filter(Boolean).slice(0, -1).join("/"),
                stat: {
                    type: "dir",
                    mtimeMs: new Date().getTime()
                },
                deleted: true
            }])
        });
    }

    async function deleteFile(path) {
        path = makePath(path);
        await fetchJSON(fsEndPoint, {
            method: "PUT",
            body: JSON.stringify([{
                id: path,
                name: path.split("/").filter(Boolean).pop(),
                folder: "/" + path.split("/").filter(Boolean).slice(0, -1).join("/"),
                stat: {
                    type: "file",
                    size: 0,
                    mtimeMs: new Date().getTime()
                },
                body: "",
                encoding: "",
                deleted: true
            }])
        });
    }

    async function readFile(path) {
        path = makePath(path);
        const item = await fetchJSON(fsEndPoint, {
            method: "GET",
            headers: {
                id: encodeURIComponent(path)
            }
        });
        if (item && item.encoding === "base64") {
            const buffer = decode(item.body);
            const blob = new Blob([new Uint8Array(buffer)]);
            return blob;
        }
        return item && item.body;
    }

    async function writeFile(path, body = "", encoding) {
        if (body && body.arrayBuffer) {
            body = await body.arrayBuffer();
            body = encode(body);
            encoding = "base64";
        }
        path = makePath(path);
        await fetchJSON(fsEndPoint, {
            method: "PUT",
            body: JSON.stringify([{
                id: path,
                name: path.split("/").filter(Boolean).pop(),
                folder: "/" + path.split("/").filter(Boolean).slice(0, -1).join("/"),
                stat: {
                    type: "file",
                    size: body.length,
                    mtimeMs: new Date().getTime()
                },
                body,
                encoding
            }])
        });
    }

    async function exists(path) {
        path = makePath(path);
        let exists = false;
        try {
            const item = await fetchJSON(fsEndPoint, {
                method: "GET",
                headers: {
                    id: encodeURIComponent(path)
                }
            });
            exists = item && !item.deleted;
        }
        catch (err) {

        }
        return exists;
    }

    return {
        getListing,
        createFolder,
        createFolders,
        deleteFolder,
        deleteFile,
        readFile,
        writeFile,
        exists
    };
};
