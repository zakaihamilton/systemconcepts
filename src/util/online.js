import { useState, useEffect, useCallback } from "react";

export function useOnline() {
    const [onlineStatus, setOnlineStatus] = useState(typeof navigator !== "undefined" && navigator.onLine);
    const onOnline = useCallback(() => setOnlineStatus(true), []);
    const onOffline = useCallback(() => setOnlineStatus(false), []);
    useEffect(() => {
        window.addEventListener("online", onOnline);
        window.addEventListener("offline", onOffline);

        return () => {
            window.removeEventListener("online", onOnline);
            window.removeEventListener("offline", onOffline);
        };
    }, [onOnline, onOffline]);
    return onlineStatus;
}
