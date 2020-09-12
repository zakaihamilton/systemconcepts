import { fetchJSON } from "@/util/fetch";

const fsEndPoint = "/api/remote";

async function getListing(path, options = {}) {
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
        const { name, stat } = item;
        const itemPath = (path.endsWith("/") ? path : path + "/") + name;
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
        item.id = item.path = "remote" + itemPath;
        item.name = name;
        item.folder = "remote" + path;
        listing.push(item);
    }
    return listing;
}

async function createFolder(path) {
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
        method: "DELETE",
        body: JSON.stringify([{ id: root }])
    });
}

async function deleteFile(path) {
    await fetchJSON(fsEndPoint, {
        method: "DELETE",
        body: JSON.stringify([{ id: path }])
    });
}

async function rename(from, to) {
    const item = await fetchJSON(fsEndPoint, {
        method: "GET",
        headers: {
            id: from
        }
    });
    item.id = to;
    item.name = to.split("/").filter(Boolean).pop();
    item.folder = to.split("/").filter(Boolean).slice(0, -1).join("/");
    item.mtimeMs = new Date().getTime();
    await fetchJSON(fsEndPoint, {
        method: "PUT",
        body: JSON.stringify([item])
    });
    await fetchJSON(fsEndPoint, {
        method: "DELETE",
        body: JSON.stringify([{ id: from }])
    });
    if (item.stat.type === "dir") {
        const listing = await getListing(root);
        for (const item of listing) {
            const source = [from, item.name].filter(Boolean).join("/");
            const target = [to, item.name].filter(Boolean).join("/");
            rename(source, target);
        }
    }
}

async function readFile(path, encoding = "utf8") {
    const item = await fetchJSON(fsEndPoint, {
        method: "GET",
        headers: {
            id: encodeURIComponent(path)
        }
    });
    return item && item.body;
}

async function writeFile(path, body, encoding = "utf8") {
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
    let exists = false;
    try {
        const item = await fetchJSON(fsEndPoint, {
            method: "GET",
            headers: {
                id: encodeURIComponent(path)
            }
        });
        exists = !!item;
    }
    catch (err) {

    }
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
