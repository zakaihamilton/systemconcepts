import { useCallback, useState, useEffect } from "react";
import { useFile } from "@util/storage";

const filePath = "/shared/library/tags.json";

export function buildTree(items, item) {
    item = item || {};
    const { id } = item;
    let children = [];
    if (id) {
        children = (items || []).filter(item => item.parent && item.parent.includes(id));
        children = children.map(item => {
            item = { ...item };
            item.tag = item.id;
            item.id = id + "/" + item.id;
            return buildTree(items, item);
        });
    }
    else {
        children = (items || []).filter(item => !item.parent || !item.parent.length || item.root);
        children = children.map(item => {
            item = { ...item };
            item.tag = item.id;
            return buildTree(items, item);
        });
    }
    return { ...item, items: children };
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
