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
    libraryUpdateCounter: 0, // Signal that library content changed
    personalSyncBusy: false, // Track personal sync status
    personalSyncProgress: { total: 0, processed: 0 },
    personalSyncError: null
});

export const UpdateSessionsStore = new Store({
    busy: false,
    status: [],
    start: 0,
    showUpdateDialog: false
});
