import storage from "@data/storage";
import { useState, useEffect, useRef, useCallback } from "react";
import { makePath, isBinaryFile } from "@util/path";
import { useGlobalState } from "@util/store";
import pLimit from "./p-limit";

const limit = pLimit(20);

export async function callMethod(item, url = "", ...params) {
    if (!url) {
        url = "";
    }
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
                    const items = (await storageMethods.getListing(device.id, ...params)) || [];
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
        // Only log errors that aren't common filesystem conflicts
        // These are handled by callers (e.g., bundle.js)
        const errorStr = (err ? (err.code || err.message || "" + err) : "").toLowerCase();
        const isCommonFsError = errorStr.includes('eisdir') ||
            errorStr.includes('enotdir') ||
            errorStr.includes('eexist') ||
            errorStr.includes('enoent');

        if (!isCommonFsError) {
            console.error(err);
        }

        // Re-throw so callers can handle the error
        throw err;
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
        name: "createFolderPath"
    },
    {
        name: "deleteFolder"
    },
    {
        name: "deleteFolderPath"
    },
    {
        name: "deleteFile"
    },
    {
        name: "readFile"
    },
    {
        name: "readFiles"
    },
    {
        name: "writeFile"
    },
    {
        name: "writeFiles"
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
    }];
}));

storageMethods.getRecursiveList = async (path) => {
    return callMethod({ name: "getRecursiveList" }, path);
};

export function useListing(url, depends = [], options) {
    const [listing, setListing] = useState(null);
    const [loading, setLoading] = useState(null);
    const [error, setError] = useState(null);
    const active = useRef(url);
    const dependsString = JSON.stringify(depends);
    const optionsString = JSON.stringify(options);
    useEffect(() => {
        setLoading(true);
        setError(null);
        active.current = url;
        storageMethods.getListing(url, options).then(listing => {
            if (active.current === url) {
                setListing(prev => {
                    if (prev === listing) return prev;
                    return listing;
                });
                setLoading(loading => {
                    if (loading === false) return loading;
                    return false;
                });
            }
        }).catch(err => {
            if (active.current === url) {
                setError(prev => {
                    if (prev === err) return prev;
                    return err;
                });
                setLoading(loading => {
                    if (loading === false) return loading;
                    return false;
                });
            }
        });
    }, [url, optionsString, dependsString]); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => {
        return () => {
            active.current = null;
        };
    }, []);
    return [listing, loading, error];
}

export function useFile(urlArgument, depends = [], mapping) {
    const url = urlArgument && makePath(urlArgument);
    const [state, setState] = useGlobalState(url && "useFile:" + url, {});
    const { data, loading, error } = state || {};
    const write = useCallback(async (data, path) => {
        path = path || url;
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
            await storageMethods.createFolderPath(path);
            await storageMethods.writeFile(path, updatedData);
        }
        else {
            let stringData = data;
            if (typeof stringData !== "string") {
                stringData = JSON.stringify(stringData, null, 4);
            }
            await storageMethods.createFolderPath(path);
            await storageMethods.writeFile(path, stringData);
            setState(state => {
                state.data = data;
                return { ...state };
            });
        }
    }, [url, setState]);
    const dependsString = JSON.stringify(depends);
    const mappingString = mapping?.toString();
    useEffect(() => {
        const timerHandle = setTimeout(() => {
            setState(state => {
                state = state || {};
                if (state.error === null) {
                    return state;
                }
                return { ...state, error: null };
            });
        }, 0);
        if (!url) {
            return () => clearTimeout(timerHandle);
        }
        setState(state => {
            state = state || {};
            if (state.loading === true) {
                return state;
            }
            return { ...state, loading: true };
        });
        storageMethods.exists(url).then(exists => {
            if (!exists) {
                let data = null;
                if (mapping) {
                    data = mapping(data, url);
                }
                setState(state => {
                    if (state.data === data && state.loading === false) {
                        return state;
                    }
                    return { ...state, loading: false, data };
                });
                return;
            }
            storageMethods.readFile(url).then(data => {
                if (mapping) {
                    data = mapping(data, url);
                }
                setState(state => {
                    if (state.data === data && state.loading === false) {
                        return state;
                    }
                    return { ...state, data, loading: false };
                });
            }).catch(err => {
                setState(state => {
                    if (state.error === err && state.loading === false) {
                        return state;
                    }
                    return { ...state, error: err, loading: false };
                });
            });
        }).catch(err => {
            setState(state => {
                if (state.error === err && state.loading === false) {
                    return state;
                }
                return { ...state, error: err, loading: false };
            });
        });
        return () => clearTimeout(timerHandle);
    }, [url, mappingString, setState, dependsString]); // eslint-disable-line react-hooks/exhaustive-deps
    return [data, loading, error, write];
}

async function getRecursiveList(path) {
    // Try to use the storage method if available (optimized)
    try {
        const result = await storageMethods.getRecursiveList(path);
        if (result) {
            return result;
        }
        console.log(`[Storage] Device method returned null/undefined for: ${path}, using fallback`);
    } catch (err) {
        // Fallback to manual recursion if method not supported or fails
        console.warn(`[Storage] Device method failed for ${path}:`, err.message || err);
    }

    // Return empty array if directory listing fails
    let listing = [];
    const visitedPaths = new Set();
    const MAX_DEPTH = 10; // Prevent runaway recursion

    const addListing = async (dirPath, depth = 0) => {
        // Prevent runaway recursion
        if (depth > MAX_DEPTH) {
            console.warn(`[Storage] Max depth exceeded for: ${dirPath}`);
            return;
        }

        // Prevent infinite loops and duplicate visits
        const normalizedPath = makePath(dirPath);
        if (visitedPaths.has(normalizedPath)) {
            return;
        }
        visitedPaths.add(normalizedPath);

        const items = await limit(() => storageMethods.getListing(dirPath));
        if (!items || !Array.isArray(items) || items.length === 0) {
            return;
        }

        // Validate items actually belong to this directory path
        const validItems = items.filter(item => {
            if (!item.path) return false;
            const itemPath = makePath(item.path);
            // Item path should start with the directory path (be a child)
            return itemPath.startsWith(normalizedPath + "/") ||
                itemPath === normalizedPath + "/" + item.name;
        });

        if (validItems.length === 0 && items.length > 0) {
            console.warn(`[Storage] Skipping ${dirPath} - ${items.length} items don't match expected path prefix`);
            return;
        }

        const files = validItems.filter(item => {
            const isDir = item.type === "dir" || item.stat?.type === "dir" || item.name?.endsWith("/");
            return !isDir;
        });
        listing.push(...files);

        const subDirs = validItems.filter(item => {
            const isDir = item.type === "dir" || item.stat?.type === "dir" || item.name?.endsWith("/");
            return isDir;
        });

        if (subDirs.length > 0) {
            await Promise.all(subDirs.map(dir => addListing(dir.path, depth + 1)));
        }
    };
    await addListing(path, 0);
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
    };
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
    await storageMethods.createFolderPath(to, true);
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
