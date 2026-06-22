// @ts-check

import { SyncActiveStore } from "./syncState";
import { getUserSyncStorageKey } from "./userStorage";

export const AUTO_SYNC_INTERVAL_MS = 12 * 60 * 1000;
export const AUTO_SYNC_JITTER_MS = 60 * 1000;

export function getCurrentVersion() {
	return process.env.NEXT_PUBLIC_VERSION || "dev";
}

export function getAutoSyncJitter() {
	if (typeof window === "undefined") return 0;
	const storageKey = getUserSyncStorageKey("sync_autoSyncJitter");
	if (!storageKey) return 0;
	const stored = Number.parseInt(localStorage.getItem(storageKey) || "", 10);
	if (Number.isFinite(stored) && stored >= 0) return stored;
	const jitter = Math.floor(Math.random() * AUTO_SYNC_JITTER_MS);
	localStorage.setItem(storageKey, String(jitter));
	return jitter;
}

export function shouldRunInitialAutoSync() {
	if (typeof window === "undefined") return false;
	const storageKey = getUserSyncStorageKey("sync_lastVersion");
	const lastVersion = storageKey ? localStorage.getItem(storageKey) : null;
	const lastSyncTime = SyncActiveStore.getRawState().lastSyncTime;
	return lastSyncTime === 0 || lastVersion !== getCurrentVersion();
}

export function persistAutoSyncVersion() {
	if (typeof window === "undefined") return;
	const storageKey = getUserSyncStorageKey("sync_lastVersion");
	if (storageKey) localStorage.setItem(storageKey, getCurrentVersion());
}
