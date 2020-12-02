import { useCallback } from "react";
import { useFile } from "@util/storage";

export const tagsFilePath = "/shared/library/tags.json";

export function buildTree(items, path = "", item) {
    item = item || {};
    const { id, name } = item;
    let children = [];
    if (name) {
        children = (items || []).filter(item => {
            const { parents } = item || {};
            return parents && parents.includes(name);
        });
    }
    else {
        children = (items || []).filter(item => !item.parents || !item.parents.length);
    }
    children = children.map(item => {
        const childId = path + "." + item.id;
        item = { ...item, name: item.id, id: childId };
        return buildTree(items, childId, item);
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
    return [record, loading, setRecord, data];
}
