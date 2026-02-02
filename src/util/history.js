import { useCallback } from "react";
import { useFile } from "@util/storage";

export function useRecentHistory() {
    const [history, loadingHistory, errorHistory, writeHistory] = useFile("local/personal/history.json", [], (data) => {
        return data ? JSON.parse(data) : [];
    });

    const addToHistory = useCallback((session) => {
        if (!session || !session.group || !session.name || !session.date) {
            return;
        }
        writeHistory(history => {
            let items = history || [];
            items = items.filter(item => item.group !== session.group || item.name !== session.name || item.date !== session.date);
            items.unshift({ ...session, timestamp: Date.now() });
            items = items.slice(0, 100);
            return items;
        });
    }, [writeHistory]);

    const removeFromHistory = useCallback((item) => {
        writeHistory(history => {
            return (history || []).filter(h => h.group !== item.group || h.name !== item.name || h.date !== item.date);
        });
    }, [writeHistory]);

    return [history, addToHistory, loadingHistory, errorHistory, removeFromHistory];
}
