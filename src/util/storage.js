import storage from "@/data/storage";
import { useState, useEffect, useRef, useCallback } from "react";
import { makePath, isBinaryFile } from "@/util/path";
import { useGlobalState } from "@/util/store";

export async function callMethod(item, url = "", ...params) {
    const { name, types } = item;
    const [deviceId, ...other] = url.split("/").filter(Boolean);
    const path = other.join("/");
    if (!deviceId) {
        if (name === "getListing") {
            const options = params[0] || {};
            const { useCount } = options;
            const results = [];
            for (const device of storage) {
                let enabled = device.enabled;
                if (typeof enabled === "function") {
                    enabled = enabled();
                }
                if (!enabled) {
                    continue;
                }
                const result = Object.assign({}, device);
                if (useCount) {
                    const items = await storageMethods.getListing(device.id, ...params) || [];
                    result.count = items.length;
                }
                results.push(result);
            }
            return results;
        }
    }
    const device = storage.find(device => device.id === deviceId);
    if (!device) {
        return null;
    }
    let result = null;
    const method = device[name];
    if (!method) {
        return null;
    }
    if (types) {
        params = params.map((param, index) => {
            const type = types[index];
            if (type === "path") {
                const [, ...other] = param.split("/").filter(Boolean);
                const path = other.join("/");
                return makePath(path);
            }
            return param;
        });
    }
    try {
        result = await method(makePath(path), ...params);
    }
    catch (err) {
        console.error(err);
    }
    return result;
}

const storageMethods = Object.fromEntries([
    {
        name: "getListing"
    },
    {
        name: "createFolder"
    },
    {
        name: "createFolders"
    },
    {
        name: "deleteFolder"
    },
    {
        name: "deleteFile"
    },
    {
        name: "readFile"
    },
    {
        name: "writeFile"
    },
    {
        name: "exists"
    },
    {
        name: "exportFolder"
    },
    {
        name: "importFolder"
    },
    {
        name: "copyFolder",
        types: ["path"]
    },
    {
        name: "copyFile",
        types: ["path"]
    }
].map(item => {
    const { name } = item;
    return [name, (...args) => {
        return callMethod(item, ...args);
    }]
}));

export function useListing(url, depends = [], options) {
    const [listing, setListing] = useState(null);
    const [loading, setLoading] = useState(null);
    const [error, setError] = useState(null);
    const active = useRef(true);
    useEffect(() => {
        setError(null);
        setLoading(true);
        storageMethods.getListing(url, options).then(listing => {
            if (active.current) {
                setListing(listing);
                setLoading(false);
            }
        }).catch(err => {
            setError(err);
            setLoading(false);
        });
    }, [url, ...depends]);
    useEffect(() => {
        return () => {
            active.current = false;
        };
    }, []);
    return [listing, loading, error];
}

export function useFile(url, depends = [], mapping) {
    url = url && makePath(url);
    const [state, setState] = useGlobalState(url && "useFile:" + url, {});
    const { data, loading, error } = state || {};
    const write = useCallback(async data => {
        if (typeof data === "function") {
            let updatedData = await new Promise((resolve) => {
                setState(state => {
                    const updatedData = data(state.data);
                    resolve(updatedData);
                    state.data = updatedData;
                    return { ...state };
                });
            });
            if (typeof updatedData !== "string") {
                updatedData = JSON.stringify(updatedData, null, 4);
            }
            await storageMethods.createFolders(url);
            await storageMethods.writeFile(url, updatedData);
        }
        else {
            await storageMethods.createFolders(url);
            await storageMethods.writeFile(url, data);
            setState(state => {
                state.data = data;
                return { ...state };
            });
        }
    }, [url]);
    useEffect(() => {
        setState(state => {
            state.error = null;
            return { ...state };
        });
        if (!url) {
            return;
        }
        setState(state => {
            state.loading = true;
            return { ...state };
        });
        storageMethods.exists(url).then(exists => {
            if (!exists) {
                let data = null;
                if (mapping) {
                    data = mapping(data, url);
                }
                setState(state => {
                    state.loading = false;
                    state.data = data;
                    return { ...state };
                });
                return;
            }
            storageMethods.readFile(url).then(data => {
                if (mapping) {
                    data = mapping(data, url);
                }
                setState(state => {
                    state.data = data;
                    state.loading = false;
                    return { ...state };
                });
            }).catch(err => {
                setState(state => {
                    state.error = err;
                    state.loading = false;
                    return { ...state };
                });
            });
        }).catch(err => {
            setState(state => {
                state.error = err;
                state.loading = false;
                return { ...state };
            });
        });
    }, [url, ...depends]);
    return [data, loading, error, write];
}

async function getRecursiveList(path) {
    let listing = [];
    const addListing = async path => {
        const data = {};
        const items = await storageMethods.getListing(path);
        listing.push(...items);
        for (const item of items) {
            const { type, path } = item;
            try {
                if (type === "dir") {
                    await addListing(path);
                }
            }
            catch (err) {
                console.error(err);
            }
        }
        return data;
    }
    await addListing(path);
    return listing;
}

async function exportFolder(path) {
    const toData = async path => {
        const data = {};
        const items = await storageMethods.getListing(path);
        for (const item of items) {
            const { name, type, path } = item;
            try {
                if (type === "dir") {
                    const result = await toData(path);
                    data[name] = result;
                }
                else if (!isBinaryFile(path)) {
                    data[name] = await storageMethods.readFile(path);
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
        await storageMethods.createFolder(root);
        const keys = Object.keys(data);
        for (const key of keys) {
            const path = makePath(root, key);
            const value = data[key];
            if (typeof value === "object") {
                await storageMethods.createFolder(path);
                if (Array.isArray(value)) {
                    for (const item of value) {
                        if (typeof item === "object") {
                            const name = item.id || item.name;
                            await fromData(makePath(path, name), item);
                        }
                    }
                }
                else {
                    await fromData(path, value);
                }
            }
            else if (typeof value === "string") {
                await storageMethods.writeFile(path, value);
            }
        }
    };
    await fromData(path, data);
}

async function copyFolder(from, to) {
    if (makePath(from) === makePath(to)) {
        return;
    }
    await storageMethods.createFolders(to);
    await storageMethods.createFolder(to);
    const items = await storageMethods.getListing(from);
    for (const item of items) {
        const { name, type } = item;
        const fromPath = makePath(from, name);
        const toPath = makePath(to, name);
        if (type === "dir") {
            await copyFolder(fromPath, toPath);
        }
        else {
            await copyFile(fromPath, toPath);
        }
    }
}

async function copyFile(from, to) {
    if (makePath(from) === makePath(to)) {
        return;
    }
    const data = await storageMethods.readFile(from);
    await storageMethods.writeFile(to, data);
}

async function moveFolder(from, to) {
    if (makePath(from) === makePath(to)) {
        return;
    }
    await copyFolder(from, to);
    await storageMethods.deleteFolder(from);
}

async function moveFile(from, to) {
    if (makePath(from) === makePath(to)) {
        return;
    }
    await copyFile(from, to);
    await storageMethods.deleteFile(from);
}

export default {
    ...storageMethods,
    exportFolder,
    importFolder,
    copyFolder,
    copyFile,
    moveFile,
    moveFolder,
    getRecursiveList
};
