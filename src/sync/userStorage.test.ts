import Cookies from "js-cookie";
import {
	clearLegacySyncStorage,
	clearUserSyncStorage,
	getUserSyncStorageKey,
	normalizeSyncUserId,
} from "./userStorage";

jest.mock("js-cookie");

describe("user-scoped sync storage", () => {
	beforeEach(() => {
		localStorage.clear();
		jest.clearAllMocks();
	});

	it("normalizes user IDs in storage keys", () => {
		expect(normalizeSyncUserId("  Alice ")).toBe("alice");
		expect(getUserSyncStorageKey("sync_lastSyncTime", "Alice")).toBe(
			"sync_lastSyncTime:alice",
		);
	});

	it("uses the signed-in user when no ID is supplied", () => {
		Cookies.get.mockReturnValue("Bob");
		expect(getUserSyncStorageKey("sync_lastVersion")).toBe(
			"sync_lastVersion:bob",
		);
	});

	it("clears only the selected user's namespaced state", () => {
		localStorage.setItem("sync_lastSyncTime:alice", "1");
		localStorage.setItem("sync_lastVersion:alice", "v1");
		localStorage.setItem("sync_lastSyncTime:bob", "2");

		clearUserSyncStorage("Alice");

		expect(localStorage.getItem("sync_lastSyncTime:alice")).toBeNull();
		expect(localStorage.getItem("sync_lastVersion:alice")).toBeNull();
		expect(localStorage.getItem("sync_lastSyncTime:bob")).toBe("2");
	});

	it("removes legacy unscoped sync metadata", () => {
		localStorage.setItem("sync_lastSyncTime", "1");
		localStorage.setItem("sync_manifest_signature:aws/sync", "signature");
		localStorage.setItem("sync_lastSyncTime:alice", "2");

		clearLegacySyncStorage();

		expect(localStorage.getItem("sync_lastSyncTime")).toBeNull();
		expect(localStorage.getItem("sync_manifest_signature:aws/sync")).toBeNull();
		expect(localStorage.getItem("sync_lastSyncTime:alice")).toBe("2");
	});
});
