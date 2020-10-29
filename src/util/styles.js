import clsx from "clsx";
import { useSize } from "@util/size";

export function getProperty(name) {
    return getComputedStyle(document.documentElement, null).getPropertyValue(name);
}

export function setProperty(name, value) {
    document.documentElement.style.setProperty(name, value);
}

export function toggleProperty(name, values) {
    const current = (getProperty(name) || "").trim();
    const value = nextTrimmedString(values, name);
    setProperty(name, value);
    return value;
}

export function useStyles(styles, data) {
    const classList = [];
    Object.keys(data || {}).map(key => {
        const value = data[key];
        if (typeof value === "function") {
            value = value(data);
        }
        if (value) {
            classList.push(styles[key]);
        }
    });
    return clsx(...classList);
}

export function useDeviceType() {
    const size = useSize();
    const isPhone = size.width <= 768;
    const isTablet = size.width >= 768 && size.width <= 1024;
    if (isTablet) {
        return "tablet";
    }
    if (isPhone) {
        return "phone";
    }
    return "desktop";
}