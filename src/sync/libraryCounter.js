import { logger as structuredLogger } from "@util/api/logger";
import { makePath } from "@util/data/path";
import storage from "@util/storage/storage";
import { LIBRARY_COUNTER_FILE, LIBRARY_LOCAL_PATH } from "./constants";
import { lockMutex } from "./mutex";
import { readFileIfExists } from "./storageReads";
import { SyncActiveStore } from "./syncState";
import { getUserSyncStorageKey } from "./userStorage";

export const LIBRARY_COUNTER_STORAGE_KEY = "sync_libraryCounter";

export async function readLibraryCounter() {
	const counterPath = makePath(LIBRARY_LOCAL_PATH, LIBRARY_COUNTER_FILE);
	try {
		const content = await readFileIfExists(storage, counterPath);
		if (content === null) return 0;
		const parsed = JSON.parse(content);
		const counter = Number.parseInt(parsed?.counter, 10);
		return Number.isFinite(counter) ? counter : 0;
	} catch (err) {
		structuredLogger.warn("[Sync] Failed to read library counter:", err);
		return 0;
	}
}

export function getSavedLibraryCounter() {
	if (typeof window === "undefined") {
		return null;
	}

	const storageKey = getUserSyncStorageKey(LIBRARY_COUNTER_STORAGE_KEY);
	if (!storageKey) return null;
	const saved = Number.parseInt(localStorage.getItem(storageKey) || "", 10);
	return Number.isFinite(saved) ? saved : null;
}

export function saveLibraryCounter(counter) {
	const storageKey = getUserSyncStorageKey(LIBRARY_COUNTER_STORAGE_KEY);
	if (typeof window !== "undefined" && storageKey && Number.isFinite(counter)) {
		localStorage.setItem(storageKey, String(counter));
	}
}

export async function bumpLibraryCounter() {
	const counterPath = makePath(LIBRARY_LOCAL_PATH, LIBRARY_COUNTER_FILE);
	const unlock = await lockMutex({ id: counterPath });
	try {
		const counter = (await readLibraryCounter()) + 1;
		await storage.createFolderPath(counterPath);
		await storage.writeFile(
			counterPath,
			JSON.stringify({ counter, updatedAt: Date.now() }, null, 2),
		);
		SyncActiveStore.update((s) => {
			s.libraryUpdateCounter = (s.libraryUpdateCounter || 0) + 1;
		});
		return counter;
	} finally {
		unlock();
	}
}
