jest.mock("js-cookie", () => ({
	__esModule: true,
	default: { get: jest.fn() },
}));

// Each test needs syncState's module-level initialization to re-run against a
// fresh localStorage/cookie state, so we reset the module registry and
// re-require both js-cookie (to get the matching fresh mock instance) and
// syncState inside every test rather than importing them statically.
function freshSyncState(userId) {
	jest.resetModules();
	const Cookies = require("js-cookie").default;
	Cookies.get.mockReturnValue(userId);
	return require("./syncState");
}

describe("syncState module initialization", () => {
	beforeEach(() => {
		localStorage.clear();
	});

	it("restores a persisted locked/autoSync/debugLevel flag on load", () => {
		localStorage.setItem("sync_locked", "true");
		localStorage.setItem("sync_autoSync", "false");
		localStorage.setItem("sync_debugLevel", "verbose");

		const { SyncActiveStore } = freshSyncState(undefined);
		const state = SyncActiveStore.getRawState();

		expect(state.locked).toBe(true);
		expect(state.autoSync).toBe(false);
		expect(state.debugLevel).toBe("verbose");
	});

	it("defaults autoSync to true when nothing is persisted yet", () => {
		const { SyncActiveStore } = freshSyncState(undefined);
		expect(SyncActiveStore.getRawState().autoSync).toBe(true);
	});

	it("restores the signed-in user's last sync time via loadUserSyncState", () => {
		localStorage.setItem("sync_lastSyncTime:user-1", "555");

		const { SyncActiveStore } = freshSyncState("user-1");
		const state = SyncActiveStore.getRawState();

		expect(state.lastSyncTime).toBe(555);
		expect(state.lastSynced).toBe(0);
		expect(state.busy).toBe(false);
	});

	it("ignores a non-finite or non-positive persisted last sync time", () => {
		localStorage.setItem("sync_lastSyncTime:user-1", "not-a-number");

		const { SyncActiveStore } = freshSyncState("user-1");
		expect(SyncActiveStore.getRawState().lastSyncTime).toBe(0);
	});

	it("persists locked/autoSync/debugLevel changes back to localStorage", () => {
		const { SyncActiveStore } = freshSyncState(undefined);

		SyncActiveStore.update((state) => {
			state.locked = true;
		});
		expect(localStorage.getItem("sync_locked")).toBe("true");

		SyncActiveStore.update((state) => {
			state.autoSync = false;
		});
		expect(localStorage.getItem("sync_autoSync")).toBe("false");

		SyncActiveStore.update((state) => {
			state.debugLevel = "verbose";
		});
		expect(localStorage.getItem("sync_debugLevel")).toBe("verbose");
	});

	it("persists lastSyncTime under a per-user storage key", () => {
		const { SyncActiveStore } = freshSyncState("user-2");

		SyncActiveStore.update((state) => {
			state.lastSyncTime = 999;
		});

		expect(localStorage.getItem("sync_lastSyncTime:user-2")).toBe("999");
	});

	it("loadUserSyncState resets busy/logs/phase for a fresh user context", () => {
		const { SyncActiveStore, loadUserSyncState } = freshSyncState("user-3");
		SyncActiveStore.update((state) => {
			state.busy = true;
			state.logs = [{ message: "old" }];
			state.phase = "Main";
			state.counter = 5;
		});

		loadUserSyncState("user-3");

		const state = SyncActiveStore.getRawState();
		expect(state.busy).toBe(false);
		expect(state.logs).toEqual([]);
		expect(state.phase).toBeNull();
		expect(state.counter).toBe(0);
	});
});
