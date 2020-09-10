import storage from "@/data/storage";
import { useState, useEffect, useRef } from "react";

export async function callMethod(item, url = "", ...params) {
    const { name, types } = item;
    const [deviceId, ...path] = url.split("/").filter(Boolean);
    if (!deviceId) {
        if (name === "getListing") {
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
                const items = await storageMethods.getListing(device.id, ...params) || [];
                result.count = items.length;
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
                const [, ...path] = param.split("/").filter(Boolean);
                return "/" + path.join("/");
            }
            return param;
        });
    }
    try {
        result = await method("/" + path.join("/"), ...params);
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
        name: "rename",
        types: ["path"]
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
    const active = useRef(true);
    useEffect(() => {
        setLoading(true);
        storageMethods.getListing(url, options).then(listing => {
            if (active.current) {
                setListing(listing);
                setLoading(false);
            }
        });
    }, [url, ...depends]);
    useEffect(() => {
        return () => {
            active.current = false;
        };
    }, []);
    return [listing, loading];
}

export default storageMethods;
