import storage from "@/data/storage";
import { useState, useEffect, useRef } from "react";

export async function createObject(url) {
    const [deviceId, ...path] = url.split("/");
    if (!deviceId) {
        return storage;
    }
    const device = storage.find(device => device.id === deviceId);
    if (!device) {
        return null;
    }
    const object = new Proxy(() => { }, device.handler(path));
    try {
        await device.init(path, object);
    }
    catch (err) {
        console.error(err);
        return null;
    }
    return object;
}


export function useObject(url) {
    const [object, setObject] = useState(null);
    const active = useRef(true);
    useEffect(() => {
        createObject(url).then(object => {
            if (active.current) {
                setObject(object);
            }
        });
    }, [url]);
    useEffect(() => {
        return () => {
            active.current = false;
        };
    }, []);
    return object;
}