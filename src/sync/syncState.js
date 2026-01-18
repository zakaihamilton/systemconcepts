import { Store } from "pullstate";

export const SyncActiveStore = new Store({
    active: 0,
    counter: 0,
    busy: false,
    lastSynced: 0,
    lastSyncTime: 0, // Track when we last attempted/completed a sync for auto-sync logic
    progress: { total: 0, processed: 0 },
    currentBundle: null,  // Track which bundle is currently being synced
    logs: [], // Store sync milestones
    lastDuration: 0, // Track duration of last successful sync
    startTime: 0, // Track when current sync started
    needsSessionReload: false, // Signal that sessions should be reloaded
    phase: null, // Track current sync phase (main, library, personal)
    libraryUpdateCounter: 0, // Signal that library content changed
    personalSyncBusy: false, // Track personal sync status
    personalSyncError: null,
    locked: false, // Track if sync upload is locked
    autoSync: true // Track if automatic sync is enabled (default: true)
});

export const UpdateSessionsStore = new Store({
    busy: false,
    status: [],
    start: 0,
    showUpdateDialog: false
});

if (typeof window !== "undefined") {
    const locked = localStorage.getItem("sync_locked");
    if (locked) {
        SyncActiveStore.update(s => {
            s.locked = locked === "true";
        });
    }

    const autoSync = localStorage.getItem("sync_autoSync");
    if (autoSync !== null) {
        SyncActiveStore.update(s => {
            s.autoSync = autoSync === "true";
        });
    }

    SyncActiveStore.subscribe(s => s.locked, locked => {
        localStorage.setItem("sync_locked", locked);
    });

    SyncActiveStore.subscribe(s => s.autoSync, autoSync => {
        localStorage.setItem("sync_autoSync", autoSync);
    });
}
