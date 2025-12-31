import { SyncActiveStore } from "@sync/syncState";

export function addSyncLog(message, type = "info") {
    SyncActiveStore.update(s => {
        s.logs = [...(s.logs || []), {
            id: Date.now() + Math.random(),
            timestamp: Date.now(),
            message,
            type
        }].slice(-100); // Keep last 100 logs
    });
}
