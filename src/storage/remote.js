import { fetchJSON } from "@util/fetch";
import { makePath } from "@util/path";

export default function remoteStorage({ fsEndPoint, deviceId, action }) {

    async function getListing(path, options = {}) {
        path = makePath(path);
        const { useCount } = options;
        const listing = [];
        let items = [];
        if (action) {
            items = await action.get({
                query: { folder: path },
                fields: { folder: 1, name: 1, stat: 1, deleted: 1 }
            });
        }
        else {
            items = await fetchJSON(fsEndPoint, {
                method: "GET",
                headers: {
                    query: encodeURIComponent(JSON.stringify({ folder: path })),
                    fields: encodeURIComponent(JSON.stringify({ folder: 1, name: 1, stat: 1, deleted: 1 }))
                }
            });
        }
        for (const item of items) {
            const { name, stat = {}, deleted } = item;
            const itemPath = makePath(path, name);
            if (deleted) {
                continue;
            }
            if (useCount && stat.type === "dir") {
                let children = [];
                if (action) {
                    children = await action.get({
                        query: { folder: itemPath },
                        fields: { folder: 1, name: 1, stat: 1 }
                    });
                }
                else {
                    children = await fetchJSON(fsEndPoint, {
                        method: "GET",
                        headers: {
                            query: encodeURIComponent(JSON.stringify({ folder: itemPath })),
                            fields: encodeURIComponent(JSON.stringify({ folder: 1, name: 1, stat: 1 })),
                        }
                    });
                }
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
            listing.push(item);
        }
        return listing;
    }

    async function getRecursiveList(path) {
        path = makePath(path);
        if (!(await exists(path))) {
            return [];
        }
        const listing = [];

        // Ensure trailing slash for directory prefix match to avoid partial matches
        // e.g. "metadata/session" matching "metadata/sessions_old"
        const prefix = path.endsWith("/") ? path : path + "/";

        let items = [];
        if (action) {
            items = await action.get({
                prefix,
                fields: { folder: 1, name: 1, stat: 1, deleted: 1, id: 1 }
            });
        }
        else {
            items = await fetchJSON(fsEndPoint, {
                method: "GET",
                headers: {
                    prefix: encodeURIComponent(prefix),
                    fields: encodeURIComponent(JSON.stringify({ folder: 1, name: 1, stat: 1, deleted: 1, id: 1 }))
                }
            });
        }

        const validFolders = new Set([path]);
        for (const item of items) {
            const { stat = {}, deleted, id } = item;
            if (!deleted && stat.type === "dir") {
                validFolders.add(id);
            }
        }

        for (const item of items) {
            const { stat = {}, deleted, id, folder } = item;
            if (deleted) {
                continue;
            }
            if (!validFolders.has(folder)) {
                continue;
            }
            // item.id is the full path in mongo.
            // We need to reconstruct the return object consistent with getListing
            Object.assign(item, stat);
            // item.path should include deviceId for the consumer
            item.path = makePath(deviceId, id);
            // item.id also
            item.id = item.path;

            listing.push(item);
        }
        return listing;
    }

    async function createFolder(path) {
        path = makePath(path);
        if (!(await exists(path))) {
            const body = [{
                id: path,
                name: path.split("/").filter(Boolean).pop(),
                folder: "/" + path.split("/").filter(Boolean).slice(0, -1).join("/"),
                stat: {
                    type: "dir",
                    mtimeMs: new Date().getTime()
                }
            }];
            if (action) {
                await action.update(body);
            }
            else {
                await fetchJSON(fsEndPoint, {
                    method: "PUT",
                    body: JSON.stringify(body)
                });
            }
        }
    }

    async function createFolders(prefix, folders) {
        const maxBytes = 4000 * 1000;
        let batch = [];
        for (const name of folders) {
            const path = makePath(prefix + name);
            if (JSON.stringify(batch).length > maxBytes) {
                if (action) {
                    await action.update(batch);
                }
                else {
                    await fetchJSON(fsEndPoint, {
                        method: "PUT",
                        body: batch
                    });
                }
                batch = [];
            }
            batch.push({
                id: path,
                name: path.split("/").filter(Boolean).pop(),
                folder: "/" + path.split("/").filter(Boolean).slice(0, -1).join("/"),
                stat: {
                    type: "dir",
                    mtimeMs: new Date().getTime()
                }
            });
        }
        if (batch.length) {
            if (action) {
                await action.update(batch);
            }
            else {
                await fetchJSON(fsEndPoint, {
                    method: "PUT",
                    body: JSON.stringify(batch)
                });
            }
        }
    }

    async function createFolderPath(path, isFolder = false) {
        path = makePath(path);
        const parts = path.split("/");
        let partIndex = parts.length - 1;
        for (; partIndex > 1; partIndex--) {
            const subPath = parts.slice(0, partIndex).join("/");
            if (await exists(subPath)) {
                break;
            }
        }
        for (partIndex++; partIndex < parts.length + (!!isFolder); partIndex++) {
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
        const body = [{
            id: root,
            name: root.split("/").filter(Boolean).pop(),
            folder: "/" + root.split("/").filter(Boolean).slice(0, -1).join("/"),
            stat: {
                type: "dir",
                mtimeMs: new Date().getTime()
            },
            deleted: true
        }];
        if (action) {
            await action.update(body);
        }
        else {
            await fetchJSON(fsEndPoint, {
                method: "PUT",
                body: JSON.stringify(body)
            });
        }
    }

    async function deleteFile(path) {
        path = makePath(path);
        const body = [{
            id: path,
            name: path.split("/").filter(Boolean).pop(),
            folder: "/" + path.split("/").filter(Boolean).slice(0, -1).join("/"),
            stat: {
                type: "file",
                size: 0,
                mtimeMs: new Date().getTime()
            },
            body: "",
            deleted: true
        }];
        if (action) {
            await action.update(body);
        }
        else {
            await fetchJSON(fsEndPoint, {
                method: "PUT",
                body: JSON.stringify(body)
            });
        }
    }

    async function readFile(path) {
        path = makePath(path);
        let item = null;
        if (action) {
            item = await action.get({ id: path });
        }
        else {
            item = await fetchJSON(fsEndPoint, {
                method: "GET",
                headers: {
                    id: encodeURIComponent(path)
                }
            });
        }
        return item && !item.deleted && item.body;
    }

    async function readFiles(prefix, files) {
        let results = {};
        files = files.map(name => makePath(prefix + name));
        while (files.length) {
            let result = [];
            if (action) {
                result = await action.get({ ids: files });
            }
            else {
                result = await fetchJSON(fsEndPoint, {
                    method: "POST",
                    body: JSON.stringify(files)
                });
            }
            if (!result || !result.length) {
                break;
            }
            files = files.filter(path => !result.find(item => item.id === path));
            for (const item of result) {
                results[item.id] = item.body;
            }
        }
        return results;
    }

    async function writeFile(path, body = "") {
        path = makePath(path);
        const data = [{
            id: path,
            name: path.split("/").filter(Boolean).pop(),
            folder: "/" + path.split("/").filter(Boolean).slice(0, -1).join("/"),
            stat: {
                type: "file",
                size: body.length,
                mtimeMs: new Date().getTime()
            },
            body
        }];
        if (action) {
            await action.update(data);
        }
        else {
            await fetchJSON(fsEndPoint, {
                method: "PUT",
                body: JSON.stringify(data)
            });
        }
    }

    async function writeFiles(prefix, files) {
        const maxBytes = 4000 * 1000;
        let batch = [];
        for (const name in files) {
            const path = makePath(prefix + name);
            const body = files[name] || "";
            if (JSON.stringify(batch).length + body.length > maxBytes) {
                if (action) {
                    await action.update(batch);
                }
                else {
                    await fetchJSON(fsEndPoint, {
                        method: "PUT",
                        body: JSON.stringify(batch)
                    });
                }
                batch = [];
            }
            batch.push({
                id: path,
                name: path.split("/").filter(Boolean).pop(),
                folder: "/" + path.split("/").filter(Boolean).slice(0, -1).join("/"),
                stat: {
                    type: "file",
                    size: body.length,
                    mtimeMs: new Date().getTime()
                },
                body
            });
        }
        if (batch.length) {
            if (action) {
                await action.update(batch);
            }
            else {
                await fetchJSON(fsEndPoint, {
                    method: "PUT",
                    body: JSON.stringify(batch)
                });
            }
        }
    }

    async function exists(path) {
        path = makePath(path);
        let exists = false;
        try {
            let item = null;
            if (action) {
                item = await action.get({ id: path });
            }
            else {
                item = await fetchJSON(fsEndPoint, {
                    method: "GET",
                    headers: {
                        id: encodeURIComponent(path)
                    }
                });
            }
            exists = item && !item.deleted;
        }
        catch {

        }
        return exists;
    }

    return {
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
};
