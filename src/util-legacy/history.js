import { useCallback } from "react";
import { useFile } from "@util-legacy/storage";

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
            const lastItem = items[0];
            const isSameSession = lastItem && lastItem.group === session.group && lastItem.name === session.name && lastItem.date === session.date;
            if (isSameSession) {
                return items;
            }
            items = [...items];
            items.unshift({ ...session, timestamp: Date.now() });
            items = items.slice(0, 300);
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
