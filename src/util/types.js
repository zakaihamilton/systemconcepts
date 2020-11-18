import { useCallback } from "react";
import { useFile } from "@util/storage";

export const typesFilePath = "/shared/library/types.json";

export function useTypes({ counter }) {
    const result = useFile(typesFilePath, [counter], data => {
        return data ? JSON.parse(data) : [];
    });
    return result;
}

export function useType({ id, counter }) {
    const [data, loading, , setData] = useTypes({ counter });
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
