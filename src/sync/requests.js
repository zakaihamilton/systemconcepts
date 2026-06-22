// @ts-check

import { persistAutoSyncVersion } from "./autoSync";
import { addSyncLog } from "./logs";
import { performSync } from "./orchestrator";
import { SyncActiveStore, UpdateSessionsStore } from "./syncState";

export async function stopSync() {
	addSyncLog("Stopping sync...", "warning");
	SyncActiveStore.update((state) => {
		state.stopping = true;
	});
}

/**
 * @param {boolean} forceReload
 */
export async function requestSync(forceReload) {
	const state = SyncActiveStore.getRawState();
	if (state.locked) addSyncLog("Sync is locked (skipping upload)", "warning");
	if (state.busy || UpdateSessionsStore.getRawState().busy) {
		if (state.stopping) {
			addSyncLog("Waiting for current sync to stop...", "info");
		}
		return;
	}
	SyncActiveStore.update((current) => {
		current.busy = true;
		current.stopping = false;
		current.startTime = Date.now();
		current.logs = [];
	});
	try {
		const result = await performSync(forceReload);
		if (!result?.completed) {
			SyncActiveStore.update((current) => {
				current.busy = false;
				current.phase = null;
			});
			return result;
		}
		const endTime = Date.now();
		const duration = endTime - SyncActiveStore.getRawState().startTime;
		persistAutoSyncVersion();
		SyncActiveStore.update((current) => {
			current.busy = false;
			current.lastSynced = endTime;
			current.lastSyncTime = endTime;
			current.lastDuration = duration;
			current.counter++;
		});
	} catch {
		SyncActiveStore.update((current) => {
			current.busy = false;
		});
	}
}
