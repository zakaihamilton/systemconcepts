import { persistAutoSyncVersion } from "./autoSync";
import { addSyncLog } from "./logs";
import { performSync } from "./orchestrator";
import { requestSync, stopSync } from "./requests";
import { SyncActiveStore, UpdateSessionsStore } from "./syncState";

jest.mock("./autoSync", () => ({ persistAutoSyncVersion: jest.fn() }));
jest.mock("./logs", () => ({ addSyncLog: jest.fn() }));
jest.mock("./orchestrator", () => ({ performSync: jest.fn() }));

function resetStores() {
	SyncActiveStore.update((state) => {
		state.busy = false;
		state.locked = false;
		state.stopping = false;
		state.startTime = 0;
		state.lastSynced = 0;
		state.lastSyncTime = 0;
		state.lastDuration = 0;
		state.counter = 0;
		state.phase = null;
	});
	UpdateSessionsStore.update((state) => {
		state.busy = false;
	});
}

describe("stopSync", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		resetStores();
	});

	it("sets the stopping flag and logs a warning", async () => {
		await stopSync();

		expect(SyncActiveStore.getRawState().stopping).toBe(true);
		expect(addSyncLog).toHaveBeenCalledWith("Stopping sync...", "warning");
	});
});

describe("requestSync", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		resetStores();
	});

	it("does nothing when a sync is already busy", async () => {
		SyncActiveStore.update((state) => {
			state.busy = true;
		});

		await requestSync(false);

		expect(performSync).not.toHaveBeenCalled();
	});

	it("logs a waiting message when busy and already stopping", async () => {
		SyncActiveStore.update((state) => {
			state.busy = true;
			state.stopping = true;
		});

		await requestSync(false);

		expect(addSyncLog).toHaveBeenCalledWith(
			"Waiting for current sync to stop...",
			"info",
		);
	});

	it("does nothing while the session-update store is busy", async () => {
		UpdateSessionsStore.update((state) => {
			state.busy = true;
		});

		await requestSync(false);

		expect(performSync).not.toHaveBeenCalled();
	});

	it("logs (but does not block on) a locked sync before proceeding", async () => {
		SyncActiveStore.update((state) => {
			state.locked = true;
		});
		performSync.mockResolvedValue({ completed: true });

		await requestSync(true);

		expect(addSyncLog).toHaveBeenCalledWith(
			"Sync is locked (skipping upload)",
			"warning",
		);
		expect(performSync).toHaveBeenCalledWith(true);
	});

	it("marks the sync busy, runs performSync, and records success on completion", async () => {
		performSync.mockResolvedValue({ completed: true });

		await requestSync(false);

		expect(persistAutoSyncVersion).toHaveBeenCalled();
		const state = SyncActiveStore.getRawState();
		expect(state.busy).toBe(false);
		expect(state.counter).toBe(1);
		expect(state.lastSynced).toBeGreaterThan(0);
	});

	it("clears busy/phase without persisting when the sync is incomplete", async () => {
		performSync.mockResolvedValue({ completed: false, reason: "incomplete" });

		const result = await requestSync(false);

		expect(result).toEqual({ completed: false, reason: "incomplete" });
		expect(persistAutoSyncVersion).not.toHaveBeenCalled();
		const state = SyncActiveStore.getRawState();
		expect(state.busy).toBe(false);
		expect(state.phase).toBeNull();
	});

	it("clears the busy flag if performSync throws", async () => {
		performSync.mockRejectedValue(new Error("pipeline exploded"));

		await requestSync(false);

		expect(SyncActiveStore.getRawState().busy).toBe(false);
	});
});
