import storage from "@/data/storage";
import { useState, useEffect, useRef } from "react";

export async function callMethod(methodName, url, ...params) {
    const [deviceId, ...path] = url.split("/").filter(Boolean);
    if (!deviceId) {
        return storage;
    }
    const device = storage.find(device => device.id === deviceId);
    if (!device) {
        return null;
    }
    let result = null;
    const method = device[methodName];
    if (!method) {
        return null;
    }
    try {
        result = await method("/" + path.join("/"), ...params);
    }
    catch (err) {
        console.error(err);
    }
    return result;
}

export async function getListing(url) {
    return callMethod("listing", url);
}

export async function createFolder(url) {
    return callMethod("createFolder", url);
}

export async function createFile(url) {
    return callMethod("createFile", url);
}

export function useListing(url, depends = []) {
    const [listing, setListing] = useState(null);
    const [loading, setLoading] = useState(null);
    const active = useRef(true);
    useEffect(() => {
        setLoading(true);
        getListing(url).then(listing => {
            if (active.current) {
                setListing(listing);
            }
            setLoading(false);
        });
    }, [url, ...depends]);
    useEffect(() => {
        return () => {
            active.current = false;
        };
    }, []);
    return [listing, loading];
}