import Cookies from "js-cookie";

const LEGACY_KEYS = [
	"sync_lastSyncTime",
	"sync_lastVersion",
	"sync_autoSyncJitter",
	"sync_libraryCounter",
];

export function normalizeSyncUserId(userId = Cookies.get("id")) {
	return String(userId || "")
		.trim()
		.toLowerCase();
}

export function getUserSyncStorageKey(key, userId) {
	const normalizedUserId = normalizeSyncUserId(userId);
	return normalizedUserId ? `${key}:${normalizedUserId}` : null;
}

export function clearLegacySyncStorage() {
	if (typeof window === "undefined") return;
	for (const key of LEGACY_KEYS) localStorage.removeItem(key);
	for (let index = localStorage.length - 1; index >= 0; index--) {
		const key = localStorage.key(index);
		if (key?.startsWith("sync_manifest_signature:aws/")) {
			localStorage.removeItem(key);
		}
	}
}

export function clearUserSyncStorage(userId) {
	if (typeof window === "undefined") return;
	const normalizedUserId = normalizeSyncUserId(userId);
	if (!normalizedUserId) return;
	const suffix = `:${normalizedUserId}`;
	for (let index = localStorage.length - 1; index >= 0; index--) {
		const key = localStorage.key(index);
		if (key?.endsWith(suffix)) localStorage.removeItem(key);
	}
}
