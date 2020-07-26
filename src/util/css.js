import { useEffect, useState } from "react";

export function getProperty(name) {
    return getComputedStyle(document.documentElement, null).getPropertyValue(name);
}

export function setProperty(name, value) {
    document.documentElement.style.setProperty(name, value);
}

export function toggleProperty(name, values) {
    const current = (getProperty(name) || "").trim();
    let index = (values || []).findIndex(value => (typeof value === "string" && value.trim()) === current);
    console.log("current", current, "values", values, "index", index);
    if (index === -1) {
        index = 0;
    }
    else {
        index = (index + 1) % values.length;
    }
    const value = values[index];
    console.log("index", index, "name", name, "value", value);
    setProperty(name, value);
    return value;
}
