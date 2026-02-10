import clsx from "clsx";
import { useWindowSize } from "@util-legacy/size";

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
    const size = useWindowSize();
    const isPhone = size.width && size.width <= 768;
    const isTablet = size.width && size.width >= 768 && size.width <= 1024;
    if (!size.width) {
        return "ssr";
    }
    if (isTablet) {
        return "tablet";
    }
    if (isPhone) {
        return "phone";
    }
    return "desktop";
}
