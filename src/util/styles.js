import clsx from "clsx";
import { useEffect, useState } from "react";

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
    // Start with "ssr" to avoid hydration mismatch
    const [deviceType, setDeviceType] = useState("ssr");

    useEffect(() => {
        const handleResize = () => {
            const width = window.innerWidth;
            let newType = "desktop";
            if (width >= 768 && width <= 1024) {
                newType = "tablet";
            } else if (width < 768) {
                newType = "phone";
            }

            setDeviceType(current => current !== newType ? newType : current);
        };

        // Initial check
        handleResize();

        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    return deviceType;
}
