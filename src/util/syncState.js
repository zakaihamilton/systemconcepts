import { Store } from "pullstate";

export const SyncActiveStore = new Store({
    active: 0,
    counter: 0,
    busy: false,
    lastSynced: 0,
    progress: { total: 0, processed: 0 },
    currentBundle: null  // Track which bundle is currently being synced
});

export const UpdateSessionsStore = new Store({
    busy: false,
    status: [],
    start: 0
});
