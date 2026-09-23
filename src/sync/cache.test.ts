import storage from "@util/storage/storage";
import { clearBundleCache, resetLocalCacheForFullSync } from "./cache";
import { SYNC_CONFIG } from "./config";
import { SyncActiveStore } from "./syncState";
import { clearLegacySyncStorage, clearUserSyncStorage } from "./userStorage";

jest.mock("@util/storage/storage", () => ({
	__esModule: true,
	default: { deleteFolder: jest.fn(), resetLocalFileSystem: jest.fn() },
}));

jest.mock("./logs", () => ({ addSyncLog: jest.fn() }));

jest.mock("./userStorage", () => ({
	clearLegacySyncStorage: jest.fn(),
	clearUserSyncStorage: jest.fn(),
	getUserSyncStorageKey: jest.fn(() => null),
}));

describe("clearBundleCache", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		storage.deleteFolder.mockResolvedValue(undefined);
		storage.resetLocalFileSystem.mockResolvedValue("systemconcepts-fs-fresh");
		SyncActiveStore.update((state) => {
			state.lastSynced = 123;
			state.lastSyncTime = 123;
			state.lastDuration = 5;
			state.counter = 3;
			state.busy = true;
			state.phase = "Main";
			state.logs = [{ message: "old" }];
		});
	});

	it("deletes the local path for every configured sync phase and resets state", async () => {
		await clearBundleCache({ userId: "user-1" });

		for (const config of SYNC_CONFIG) {
			expect(storage.deleteFolder).toHaveBeenCalledWith(config.localPath);
		}
		expect(clearUserSyncStorage).toHaveBeenCalledWith("user-1");
		expect(clearLegacySyncStorage).toHaveBeenCalled();

		const state = SyncActiveStore.getRawState();
		expect(state).toMatchObject({
			lastSynced: 0,
			lastSyncTime: 0,
			lastDuration: 0,
			counter: 0,
			busy: false,
			phase: null,
			logs: [],
		});
	});

	it("skips clearing persisted storage when clearPersistedState is false", async () => {
		await clearBundleCache({ clearPersistedState: false });

		expect(clearUserSyncStorage).not.toHaveBeenCalled();
		expect(clearLegacySyncStorage).not.toHaveBeenCalled();
	});

	it("logs and swallows errors instead of throwing", async () => {
		storage.deleteFolder.mockRejectedValue(new Error("disk error"));

		await expect(clearBundleCache()).resolves.toBeUndefined();
	});
});

describe("resetLocalCacheForFullSync", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		storage.resetLocalFileSystem.mockResolvedValue("systemconcepts-fs-fresh");
		SyncActiveStore.update((state) => {
			state.lastSynced = 123;
			state.lastSyncTime = 123;
			state.lastDuration = 5;
			state.counter = 3;
			state.busy = true;
			state.phase = "Main";
			state.logs = [{ message: "old" }];
		});
	});

	it("switches to a fresh database without touching the current filesystem", async () => {
		await resetLocalCacheForFullSync({ userId: "user-1" });

		expect(storage.resetLocalFileSystem).toHaveBeenCalledTimes(1);
		expect(storage.deleteFolder).not.toHaveBeenCalled();
		expect(clearUserSyncStorage).toHaveBeenCalledWith("user-1");
		expect(clearLegacySyncStorage).toHaveBeenCalledTimes(1);

		expect(SyncActiveStore.getRawState()).toMatchObject({
			lastSynced: 0,
			lastSyncTime: 0,
			lastDuration: 0,
			counter: 0,
			busy: false,
			phase: null,
		});
	});

	it("does not continue to the sync pipeline when a fresh database cannot start", async () => {
		const error = new Error("fresh database failed");
		storage.resetLocalFileSystem.mockRejectedValue(error);

		await expect(resetLocalCacheForFullSync()).rejects.toBe(error);
		expect(clearUserSyncStorage).not.toHaveBeenCalled();
		expect(clearLegacySyncStorage).not.toHaveBeenCalled();
	});
});
