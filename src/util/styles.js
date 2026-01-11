import { useState, useEffect } from "react";
import clsx from "clsx";
import { nextTrimmedString } from "@util/array";

export function getProperty(name) {
    return getComputedStyle(document.documentElement, null).getPropertyValue(name);
}

export function setProperty(name, value) {
    document.documentElement.style.setProperty(name, value);
}

export function toggleProperty(name, values) {
    const value = nextTrimmedString(values, name);
    setProperty(name, value);
    return value;
}

export function useStyles(styles, data) {
    const classList = [];
    // Optimization: Use for...of instead of map to avoid creating unnecessary arrays
    for (const key of Object.keys(data || {})) {
        let value = data[key];
        if (typeof value === "function") {
            value = value(data);
        }
        if (value) {
            classList.push(styles[key]);
        }
    }
    return clsx(...classList);
}

export function useDeviceType() {
    const [deviceType, setDeviceType] = useState(() => {
        if (typeof window === "undefined") {
            return "ssr";
        }
        const width = window.innerWidth;
        if (width < 768) return "phone";
        if (width <= 1024) return "tablet";
        return "desktop";
    });

    useEffect(() => {
        const handleResize = () => {
            const width = window.innerWidth;
            let newType = "desktop";
            if (width < 768) {
                newType = "phone";
            } else if (width <= 1024) {
                newType = "tablet";
            }

            setDeviceType(prev => prev === newType ? prev : newType);
        };

        // Handle initial load
        handleResize();

        let timeoutId = null;
        const onResize = () => {
            if (timeoutId) clearTimeout(timeoutId);
            timeoutId = setTimeout(handleResize, 100);
        };

        window.addEventListener("resize", onResize);
        return () => {
            if (timeoutId) clearTimeout(timeoutId);
            window.removeEventListener("resize", onResize);
        };
    }, []);

    return deviceType;
}
