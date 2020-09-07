import { fetchJSON } from "@/util/fetch";

async function getListing(path) {
    const listing = [];
    const items = await fetchJSON("/api/fs", {
        method: "GET",
        headers: {
            query: encodeURIComponent(JSON.stringify({ folder: path })),
            fields: encodeURIComponent(JSON.stringify({ folder: true, name: true, stat: true })),
        }
    });
    for (const item of items) {
        const { name, stat } = item;
        const itemPath = [path, name].filter(Boolean).join("/");
        if (stat.type === "dir") {
            const children = await fetchJSON("/api/fs", {
                method: "GET",
                headers: {
                    query: encodeURIComponent(JSON.stringify({ folder: itemPath })),
                    fields: encodeURIComponent(JSON.stringify({ folder: true, name: true, stat: true })),
                }
            });
            let count = 0;
            for (const item of children) {
                if (item.type === "dir") {
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
        await fetchJSON("/api/fs", {
            method: "PUT",
            body: JSON.stringify([{
                id: path,
                name: path.split("/").filter(Boolean).pop(),
                folder: "/" + path.split("/").filter(Boolean).slice(0, -1).join("/"),
                stat: {
                    type: "dir"
                }
            }])
        });
    }
}

async function createFile(path) {
    if (!await exists(path)) {
        await fetchJSON("/api/fs", {
            method: "PUT",
            body: JSON.stringify([{
                id: path,
                name: path.split("/").filter(Boolean).pop(),
                folder: "/" + path.split("/").filter(Boolean).slice(0, -1).join("/"),
                stat: {
                    type: "file",
                    size: 0
                },
                body: ""
            }])
        });
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
    await fetchJSON("/api/fs", {
        method: "DELETE",
        body: JSON.stringify([{ id: root }])
    });
}

async function deleteFile(path) {
    await fetchJSON("/api/fs", {
        method: "DELETE",
        body: JSON.stringify([{ id: path }])
    });
}

async function rename(from, to) {
    const item = await fetchJSON("/api/fs", {
        method: "GET",
        headers: {
            id: from
        }
    });
    item.id = to;
    item.name = to.split("/").filter(Boolean).pop();
    item.folder = to.split("/").filter(Boolean).slice(0, -1);
    await fetchJSON("/api/fs", {
        method: "PUT",
        body: JSON.stringify([item])
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
    const item = await fetchJSON("/api/fs", {
        method: "GET",
        headers: {
            id: encodeURIComponent(path)
        }
    });
    return item && item.body;
}

async function writeFile(path, body, encoding = "utf8") {
    await fetchJSON("/api/fs", {
        method: "PUT",
        body: JSON.stringify([{
            id: path,
            name: path.split("/").filter(Boolean).pop(),
            folder: "/" + path.split("/").filter(Boolean).slice(0, -1).join("/"),
            stat: {
                type: "file",
                size: body.length,
            },
            body
        }])
    });
}

async function exists(path) {
    let exists = false;
    try {
        const item = await fetchJSON("/api/fs", {
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

async function exportFolder(path) {
    const toData = async path => {
        const data = {};
        const items = await fetchJSON("/api/fs", {
            method: "GET",
            headers: {
                query: encodeURIComponent(JSON.stringify({ folder: path })),
                fields: encodeURIComponent(JSON.stringify({ folder: true, name: true, stat: true })),
            }
        });
        for (const item of items) {
            const { name, stat } = item;
            const itemPath = [path, name].filter(Boolean).join("/");
            try {
                if (stat.type === "dir") {
                    const result = await toData(itemPath);
                    data[name] = result;
                }
                else {
                    data[name] = await readFile(itemPath, "utf8");
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
                await writeFile(path, value, "utf8");
            }
        }
    };
    await fromData(path, data);
}

async function copyFolder(from, to) {
    await createFolder(to);
    const items = await fetchJSON("/api/fs", {
        method: "GET",
        headers: {
            query: encodeURIComponent(JSON.stringify({ folder: from })),
            fields: encodeURIComponent(JSON.stringify({ folder: true, name: true, stat: true })),
        }
    });
    for (const item of items) {
        const { name, stat } = item;
        const itemPath = [path, name].filter(Boolean).join("/"); try {
            const fromPath = [from, name].filter(Boolean).join("/");
            const toPath = [to, name].filter(Boolean).join("/");
            if (stat.type === "dir") {
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
    createFile,
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
