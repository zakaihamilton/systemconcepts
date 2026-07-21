import { createSyncOrchestrator } from "./orchestrator";
import { SyncActiveStore, UpdateSessionsStore } from "./syncState";

const mainConfig = {
	name: "Main",
	localPath: "local/sync",
	remotePath: "aws/sync",
	direction: "bi",
	uploadsRole: "admin",
};

function resetStores() {
	SyncActiveStore.update((state) => {
		state.busy = false;
		state.locked = false;
		state.stopping = false;
		state.phase = null;
		state.needsSessionReload = false;
		state.libraryUpdateCounter = 0;
		state.logs = [];
	});
	UpdateSessionsStore.update((state) => {
		state.busy = false;
	});
}

function makeDependencies(overrides = {}) {
	const unlock = jest.fn();
	return {
		cookies: {
			get: jest.fn((name) => {
				if (name === "role") return "student";
				if (name === "id") return "user-1";
				if (name === "hash") return "hash";
			}),
			set: jest.fn(),
		},
		fetchJSON: jest.fn(),
		roleAuth: jest.fn((role, required) => {
			if (required === "student") return role === "student" || role === "admin";
			return role === "admin";
		}),
		logger: { debug: jest.fn(), error: jest.fn(), warn: jest.fn() },
		addSyncLog: jest.fn(),
		configs: [mainConfig],
		getReadOnlyManifestFreshness: jest.fn().mockResolvedValue(null),
		persistManifestSignature: jest.fn(),
		executeSyncPipeline: jest.fn().mockResolvedValue({
			hasChanges: false,
			complete: true,
			newOffset: 10,
		}),
		lockMutex: jest.fn().mockResolvedValue(unlock),
		isMutexLocked: jest.fn().mockReturnValue(false),
		getMutex: jest.fn(),
		unlock,
		...overrides,
	};
}

describe("sync orchestration recovery", () => {
	beforeEach(resetStores);

	it("does not persist freshness after an incomplete download", async () => {
		const freshness = { fresh: false, storageKey: "key", signature: "value" };
		const dependencies = makeDependencies({
			getReadOnlyManifestFreshness: jest.fn().mockResolvedValue(freshness),
			executeSyncPipeline: jest.fn().mockResolvedValue({
				hasChanges: true,
				complete: false,
				newOffset: 10,
			}),
		});

		const result = await createSyncOrchestrator(dependencies)(false);

		expect(result).toEqual({ completed: false, reason: "incomplete" });
		expect(dependencies.persistManifestSignature).not.toHaveBeenCalled();
		expect(dependencies.addSyncLog).toHaveBeenCalledWith(
			expect.stringContaining("sync incomplete"),
			"warning",
		);
	});

	it("skips a fresh read-only pipeline unless the sync is forced", async () => {
		const dependencies = makeDependencies({
			getReadOnlyManifestFreshness: jest
				.fn()
				.mockResolvedValue({ fresh: true }),
		});
		const performSync = createSyncOrchestrator(dependencies);

		await performSync(false);
		expect(dependencies.executeSyncPipeline).not.toHaveBeenCalled();

		await performSync(true);
		expect(dependencies.executeSyncPipeline).toHaveBeenCalledTimes(1);
	});

	it("releases the mutex and clears phase after a pipeline exception", async () => {
		const failure = new Error("download failed");
		const dependencies = makeDependencies({
			executeSyncPipeline: jest.fn().mockRejectedValue(failure),
		});

		await expect(createSyncOrchestrator(dependencies)(true)).rejects.toThrow(
			"download failed",
		);

		expect(dependencies.unlock).toHaveBeenCalledTimes(1);
		expect(SyncActiveStore.getRawState().phase).toBeNull();
		expect(UpdateSessionsStore.getRawState().busy).toBe(false);
	});

	it("rejects expired authentication and releases the mutex", async () => {
		SyncActiveStore.update((state) => {
			state.busy = true;
		});
		UpdateSessionsStore.update((state) => {
			state.busy = true;
		});
		const dependencies = makeDependencies({
			cookies: {
				get: jest.fn((name) => (name === "role" ? "visitor" : undefined)),
				set: jest.fn(),
			},
			roleAuth: jest.fn().mockReturnValue(false),
		});

		const result = await createSyncOrchestrator(dependencies)(false);

		expect(result).toEqual({ completed: false, reason: "unauthorized" });
		expect(SyncActiveStore.getRawState().busy).toBe(false);
		expect(UpdateSessionsStore.getRawState().busy).toBe(false);
		expect(dependencies.unlock).toHaveBeenCalledTimes(1);
	});

	it("stops before the next configured pipeline", async () => {
		const secondConfig = { ...mainConfig, name: "Library" };
		const executeSyncPipeline = jest.fn().mockImplementation(async () => {
			SyncActiveStore.update((state) => {
				state.stopping = true;
			});
			return { hasChanges: false, complete: true, newOffset: 10 };
		});
		const dependencies = makeDependencies({
			configs: [mainConfig, secondConfig],
			executeSyncPipeline,
		});

		await createSyncOrchestrator(dependencies)(true);

		expect(executeSyncPipeline).toHaveBeenCalledTimes(1);
		expect(dependencies.addSyncLog).toHaveBeenCalledWith(
			"Sync stopped by user",
			"warning",
		);
	});

	it("sets reload and library signals only when changes are reported", async () => {
		const libraryConfig = { ...mainConfig, name: "Library" };
		const dependencies = makeDependencies({
			configs: [libraryConfig],
			executeSyncPipeline: jest.fn().mockResolvedValue({
				hasChanges: true,
				complete: true,
				newOffset: 10,
			}),
		});

		await createSyncOrchestrator(dependencies)(false);

		expect(SyncActiveStore.getRawState().needsSessionReload).toBe(true);
		expect(SyncActiveStore.getRawState().libraryUpdateCounter).toBe(1);
	});

	it("refreshes role from the API when cookies lack a role", async () => {
		const dependencies = makeDependencies({
			cookies: {
				get: jest.fn((name) => {
					if (name === "id") return "user-1";
					if (name === "hash") return "hash";
				}),
				set: jest.fn(),
			},
			fetchJSON: jest.fn().mockResolvedValue({ role: "student" }),
		});

		await createSyncOrchestrator(dependencies)(false);

		expect(dependencies.fetchJSON).toHaveBeenCalledWith("/api/login");
		expect(dependencies.cookies.set).toHaveBeenCalledWith("role", "student", {
			expires: 60,
		});
	});

	it("logs and keeps the prior role when refresh fails", async () => {
		const dependencies = makeDependencies({
			cookies: {
				get: jest.fn((name) => {
					if (name === "role") return "visitor";
					if (name === "id") return "user-1";
					if (name === "hash") return "hash";
				}),
				set: jest.fn(),
			},
			roleAuth: jest.fn((role, required) => {
				if (required === "student") return role === "student";
				return role === "admin";
			}),
			fetchJSON: jest.fn().mockRejectedValue(new Error("network")),
		});

		const result = await createSyncOrchestrator(dependencies)(false);

		expect(result).toEqual({ completed: false, reason: "unauthorized" });
		expect(dependencies.addSyncLog).toHaveBeenCalledWith(
			expect.stringContaining("Role refresh failed"),
			"error",
		);
	});

	it("clears a stuck mutex lock in the finally block", async () => {
		const lock = { _locks: 1, _locking: Promise.resolve() };
		const dependencies = makeDependencies({
			isMutexLocked: jest.fn().mockReturnValue(true),
			getMutex: jest.fn().mockReturnValue(lock),
		});

		await createSyncOrchestrator(dependencies)(false);

		expect(lock._locks).toBe(0);
		expect(SyncActiveStore.getRawState().busy).toBe(false);
	});

	it("persists manifest signature after a complete read-only sync", async () => {
		const freshness = { fresh: false, storageKey: "key", signature: "sig" };
		const dependencies = makeDependencies({
			configs: [{ ...mainConfig, direction: "pull", uploadsRole: "admin" }],
			getReadOnlyManifestFreshness: jest.fn().mockResolvedValue(freshness),
		});

		await createSyncOrchestrator(dependencies)(false);

		expect(dependencies.persistManifestSignature).toHaveBeenCalledWith(
			freshness,
		);
	});

	it("reports no changes when sync completes without modifications", async () => {
		const dependencies = makeDependencies();

		const result = await createSyncOrchestrator(dependencies)(false);

		expect(result).toEqual({ completed: true });
		expect(dependencies.addSyncLog).toHaveBeenCalledWith(
			"No changes detected",
			"info",
		);
		expect(UpdateSessionsStore.getRawState().busy).toBe(false);
	});

	it("maps 401 errors to a login prompt in the sync log", async () => {
		const dependencies = makeDependencies({
			executeSyncPipeline: jest.fn().mockRejectedValue(401),
		});

		await expect(createSyncOrchestrator(dependencies)(false)).rejects.toBe(401);
		expect(dependencies.addSyncLog).toHaveBeenCalledWith(
			"Sync failed: Please login to sync",
			"error",
		);
	});
});
