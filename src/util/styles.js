import clsx from "clsx";
import React, { useEffect, useState } from "react";
import im from "node_modules/include-media-export/include-media.js";
import { useCounter } from "./hooks";

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

export function useImportMedia(callback) {
    const [, incCounter] = useCounter();
    const value = callback(im);
    useEffect(() => {
        window.addEventListener('resize', incCounter);
        return () => window.removeEventListener('resize', incCounter);
    });
    return value;
}

export function useDeviceType() {
    return useImportMedia(im => {
        const isPhone = im.lessThan('tablet');
        const isTablet = im.greaterThan('tablet') && im.lessThan('desktop');
        if (isTablet) {
            return "tablet";
        }
        if (isPhone) {
            return "phone";
        }
        return "desktop";
    });
}