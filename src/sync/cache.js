// @ts-check

import { logger as structuredLogger } from "@util/api/logger";
import storage from "@util/storage/storage";
import { SYNC_CONFIG } from "./config";
import { addSyncLog } from "./logs";
import { beginFreshLocalWriteGeneration } from "./steps/downloadUpdates";
import { SyncActiveStore } from "./syncState";
import { clearLegacySyncStorage, clearUserSyncStorage } from "./userStorage";

/**
 * @param {{clearPersistedState?: boolean, userId?: string}} [options]
 */
export async function clearBundleCache({
	clearPersistedState = true,
	userId,
} = {}) {
	try {
		addSyncLog("Clearing all sync data...", "warning");
		for (const config of SYNC_CONFIG) {
			await /** @type {any} */ (storage).deleteFolder(config.localPath);
		}
		if (clearPersistedState) {
			clearUserSyncStorage(userId);
			clearLegacySyncStorage();
		}
		SyncActiveStore.update((state) => {
			state.lastSynced = 0;
			state.lastSyncTime = 0;
			state.lastDuration = 0;
			state.counter = 0;
			state.busy = false;
			state.phase = null;
			state.logs = [];
		});
		addSyncLog("✓ All sync data cleared", "success");
	} catch (error) {
		structuredLogger.error("[Sync] Error clearing cache:", error);
	}
}

/**
 * Reset the entire LightningFS cache before a user-requested Full Sync.
 * @param {{userId?: string}} options
 */
export async function resetLocalCacheForFullSync(options = {}) {
	const { userId } = options;
	addSyncLog("Starting Full Sync with a fresh local database…", "warning");
	const databaseName = await storage.resetLocalFileSystem();
	structuredLogger.info("[Sync] Switched to fresh LightningFS database", {
		databaseName,
	});
	beginFreshLocalWriteGeneration();
	clearUserSyncStorage(userId);
	clearLegacySyncStorage();
	SyncActiveStore.update((state) => {
		state.lastSynced = 0;
		state.lastSyncTime = 0;
		state.lastDuration = 0;
		state.counter = 0;
		state.busy = false;
		state.phase = null;
		state.logs = [];
	});
	addSyncLog(
		"✓ Fresh local database ready; downloading all remote files",
		"success",
	);
}
