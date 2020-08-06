import storage from "@/data/storage";
import { useState, useEffect, useRef } from "react";

export async function callMethod(methodName, url, ...params) {
    const [deviceId, ...path] = url.split("/");
    if (!deviceId) {
        return storage;
    }
    const device = storage.find(device => device.id === deviceId);
    if (!device) {
        return null;
    }
    let listing = null;
    const method = device[methodName];
    if (!method) {
        return null;
    }
    try {
        listing = await method(path, ...params);
    }
    catch (err) {
        console.error(err);
    }
    return listing;
}

export async function getListing(url) {
    return callMethod("listing", url);
}

export async function createFolder(url) {
    return callMethod("createFolder", url);
}

export function useListing(url) {
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
    }, [url]);
    useEffect(() => {
        return () => {
            active.current = false;
        };
    }, []);
    return [listing, loading];
}