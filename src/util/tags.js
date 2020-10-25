import { useCallback, useState, useEffect } from "react";
import { useFile } from "@util/storage";

const filePath = "/shared/library/tags.json";

export function buildTree(items, item) {
    item = item || { id: "root" };
    const { id } = item;
    if (!id) {
        console.log("root items", items);
        items = (items || []).filter(item => !item.parent || !item.parent.length);
        console.log("id", id, "items", items);
        items = items.map(item => buildTree(items, item));
    }
    return { ...item, items };
}

export function useTags({ counter }) {
    const result = useFile(filePath, [counter], data => {
        return data ? JSON.parse(data) : [];
    });
    return result;
}

export function useTag({ id, counter }) {
    const [data, loading, , setData] = useTags({ counter });
    const record = (data || []).find(item => item && item.id === id);
    const setRecord = useCallback(record => {
        setData(data => {
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
