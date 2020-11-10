import { useCallback } from "react";
import { useFile } from "@util/storage";

export const tagsFilePath = "/shared/library/tags.json";

export function buildTree(items, path = "", item) {
    item = item || {};
    const { id } = item;
    let children = [];
    if (id) {
        children = (items || []).filter(item => {
            const { id, name } = item || {};
            return id === path + "." + name;
        });
    }
    else {
        children = (items || []).filter(item => !item.id.includes("."));
    }
    children = children.map(item => {
        item = { ...item };
        return buildTree(items, item.id, item);
    });
    children.sort((a, b) => b.id.localeCompare(a.id));
    return { ...item, items: children };
}

export function useTags({ counter }) {
    const result = useFile(tagsFilePath, [counter], data => {
        return data ? JSON.parse(data) : [];
    });
    return result;
}

export function uniqueTags(tags) {
    return Array.from(new Set((tags || []).filter(tag => tag.id === tag.name).map(tag => tag.name)));
}

export function useTag({ id, counter }) {
    const [data, loading, , setData] = useTags({ counter });
    const record = (data || []).find(item => item && item.id === id);
    const setRecord = useCallback(record => {
        return setData(data => {
            data = [...data];
            const recordIndex = data.findIndex(item => item && item.id === id);
            if (recordIndex !== -1) {
                data[recordIndex] = record;
            }
            else {
                data.push(record);
            }
            return data;
        });
    });
    return [record, loading, setRecord];
}
