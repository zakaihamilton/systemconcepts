import { Store } from "pullstate";

export const SyncActiveStore = new Store({
    active: 0,
    counter: 0,
    busy: false,
    lastSynced: 0,
    progress: { total: 0, processed: 0 },
    currentBundle: null,  // Track which bundle is currently being synced
    logs: [], // Store sync milestones
    lastDuration: 0, // Track duration of last successful sync
    startTime: 0, // Track when current sync started
    needsSessionReload: false // Signal that sessions should be reloaded
});

export const UpdateSessionsStore = new Store({
    busy: false,
    status: [],
    start: 0
});
