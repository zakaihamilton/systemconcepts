import { fetchJSON } from "@util/fetch";
import { makePath } from "@util/path";

export default function remoteStorage({ fsEndPoint, deviceId }) {

    async function getListing(path, options = {}) {
        path = makePath(path);
        const { useCount } = options;
        const listing = [];
        const items = await fetchJSON(fsEndPoint, {
            method: "GET",
            headers: {
                query: encodeURIComponent(JSON.stringify({ folder: path })),
                fields: encodeURIComponent(JSON.stringify({ folder: 1, name: 1, stat: 1, deleted: 1 }))
            }
        });
        for (const item of items) {
            const { name, stat = {}, deleted } = item;
            const itemPath = makePath(path, name);
            if (deleted) {
                continue;
            }
            if (useCount && stat.type === "dir") {
                const children = await fetchJSON(fsEndPoint, {
                    method: "GET",
                    headers: {
                        query: encodeURIComponent(JSON.stringify({ folder: itemPath })),
                        fields: encodeURIComponent(JSON.stringify({ folder: 1, name: 1, stat: 1 })),
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
            listing.push(item);
        }
        return listing;
    }

    async function createFolder(path) {
        path = makePath(path);
        if (!(await exists(path))) {
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

    async function createFolders(prefix, folders) {
        const maxBytes = 4000 * 1000;
        let batch = [];
        for (const name of folders) {
            const path = makePath(prefix + name);
            if (JSON.stringify(batch).length > maxBytes) {
                await fetchJSON(fsEndPoint, {
                    method: "PUT",
                    body: batch
                });
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
            await fetchJSON(fsEndPoint, {
                method: "PUT",
                body: JSON.stringify(batch)
            });
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
        return item && !item.deleted && item.body;
    }

    async function readFiles(prefix, files) {
        let results = {};
        files = files.map(name => makePath(prefix + name));

        // Dynamic batching: start with larger batch size and adjust based on response
        const maxBatchSize = 100; // Increased from 50 to reduce API calls
        const maxResponseSize = 3.5 * 1024 * 1024; // 3.5MB to stay safely under 4MB limit
        let currentBatchSize = maxBatchSize;
        let batchCount = 0;

        while (files.length) {
            // Take a batch of files
            const batch = files.slice(0, currentBatchSize);
            batchCount++;

            try {
                console.log(`[readFiles] Fetching batch ${batchCount} with ${batch.length} files from ${deviceId}`);

                const result = await fetchJSON(fsEndPoint, {
                    method: "POST",
                    body: JSON.stringify(batch)
                });

                if (!result || !result.length) {
                    // Remove failed files from the list
                    files = files.filter(path => !batch.includes(path));
                    console.log(`[readFiles] Batch ${batchCount} returned no results, ${files.length} files remaining`);
                    continue;
                }

                // Estimate response size for dynamic batch adjustment
                const responseSize = JSON.stringify(result).length;

                // Adjust batch size for next iteration if response is too large or too small
                if (responseSize > maxResponseSize && currentBatchSize > 10) {
                    currentBatchSize = Math.max(10, Math.floor(currentBatchSize * 0.7));
                    console.log(`[readFiles] Response size ${(responseSize / 1024 / 1024).toFixed(2)}MB, reducing batch size to ${currentBatchSize}`);
                } else if (responseSize < maxResponseSize * 0.5 && currentBatchSize < maxBatchSize) {
                    currentBatchSize = Math.min(maxBatchSize, Math.floor(currentBatchSize * 1.3));
                }

                // Store results
                for (const item of result) {
                    results[item.id] = item.body;
                }

                console.log(`[readFiles] Batch ${batchCount} completed: ${result.length} files fetched, ${files.length - batch.length} remaining`);

                // Remove successfully fetched files
                files = files.filter(path => !result.find(item => item.id === path));
            } catch (err) {
                console.error(`[readFiles] Error reading batch ${batchCount}:`, err);
                // Reduce batch size on error
                if (currentBatchSize > 10) {
                    currentBatchSize = Math.max(10, Math.floor(currentBatchSize * 0.5));
                    console.log(`[readFiles] Reducing batch size to ${currentBatchSize} after error`);
                }
                // Remove failed batch from the list to avoid infinite loop
                files = files.filter(path => !batch.includes(path));
            }
        }

        console.log(`[readFiles] Completed: ${Object.keys(results).length} files fetched in ${batchCount} batches from ${deviceId}`);
        return results;
    }

    async function writeFile(path, body = "") {
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
                body
            }])
        });
    }

    async function writeFiles(prefix, files) {
        const maxBytes = 4000 * 1000;
        let batch = [];
        for (const name in files) {
            const path = makePath(prefix + name);
            const body = files[name] || "";
            if (JSON.stringify(batch).length + body.length > maxBytes) {
                await fetchJSON(fsEndPoint, {
                    method: "PUT",
                    body: JSON.stringify(batch)
                });
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
            await fetchJSON(fsEndPoint, {
                method: "PUT",
                body: JSON.stringify(batch)
            });
        }
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
