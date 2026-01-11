import { SyncActiveStore } from "@sync/syncState";

export function addSyncLog(message, type = "info") {
    // Also log to console for debugging
    const logMethod = type === "error" ? console.error : type === "warning" ? console.warn : console.log;
    logMethod(`[Sync] ${message}`);

    SyncActiveStore.update(s => {
        s.logs = [...(s.logs || []), {
            id: Date.now() + Math.random(),
            timestamp: Date.now(),
            message,
            type
        }].slice(-200); // Keep last 200 logs
    });
}
