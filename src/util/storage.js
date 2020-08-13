import storage from "@/data/storage";
import { useState, useEffect, useRef } from "react";

export async function callMethod(item, url = "", ...params) {
    const { name, types } = item;
    const [deviceId, ...path] = url.split("/").filter(Boolean);
    if (!deviceId) {
        return storage;
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
        name: "createFile"
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
        name: "exportFile"
    }
].map(item => {
    const { name } = item;
    return [name, (...args) => {
        return callMethod(item, ...args);
    }]
}));

export function useListing(url, depends = []) {
    const [listing, setListing] = useState(null);
    const [loading, setLoading] = useState(null);
    const active = useRef(true);
    useEffect(() => {
        setLoading(true);
        storageMethods.getListing(url).then(listing => {
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
