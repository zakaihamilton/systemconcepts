import { useEffect, useState } from "react";

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
