import { createSyncPipeline } from "./pipeline";
import { SyncActiveStore } from "./syncState";

class ProgressTracker {
	updateProgress() {}
	completeStep() {}
	setComplete() {}
	usePersonalWeights() {}
	getCurrentOffset() {
		return 10;
	}
}

function makeDependencies(roleAuth) {
	const manifest = [];
	manifest.loadedFromManifest = true;
	manifest.authoritative = true;
	return {
		storage: {
			createFolderPath: jest.fn(),
			exists: jest.fn().mockResolvedValue(false),
			writeFile: jest.fn(),
		},
		roleAuth,
		addSyncLog: jest.fn(),
		logger: { warn: jest.fn(), debug: jest.fn(), error: jest.fn() },
		ProgressTracker,
		getLocalFiles: jest.fn().mockResolvedValue([]),
		readLibraryCounter: jest.fn().mockResolvedValue(0),
		getSavedLibraryCounter: jest.fn().mockReturnValue(null),
		saveLibraryCounter: jest.fn(),
		syncManifest: jest.fn().mockResolvedValue(manifest),
		migrateFromMongoDB: jest.fn(),
		updateLocalManifest: jest.fn().mockResolvedValue([]),
		downloadUpdates: jest.fn().mockResolvedValue({
			manifest: [],
			hasChanges: false,
			complete: true,
		}),
		removeDeletedFiles: jest
			.fn()
			.mockResolvedValue({ manifest: [], hasChanges: false }),
		uploadUpdates: jest
			.fn()
			.mockResolvedValue({ manifest: [], hasChanges: false }),
		uploadNewFiles: jest
			.fn()
			.mockResolvedValue({ manifest: [], hasChanges: false }),
		deleteRemoteFiles: jest.fn().mockResolvedValue([]),
		applyRemoteTombstones: jest.fn().mockResolvedValue({
			manifest: [],
			hasChanges: false,
			complete: true,
		}),
		uploadManifest: jest.fn(),
		createSyncTrashId: jest.fn().mockReturnValue("sync-test"),
	};
}

describe("sync pipeline permissions", () => {
	beforeEach(() => {
		SyncActiveStore.update((state) => {
			state.locked = false;
		});
	});

	it("does not execute upload steps without the required role", async () => {
		const dependencies = makeDependencies(jest.fn().mockReturnValue(false));
		const execute = createSyncPipeline(dependencies);

		await execute(
			{
				name: "Main",
				localPath: "local/sync",
				remotePath: "aws/sync",
				direction: "bi",
				uploadsRole: "admin",
			},
			"student",
			"user-1",
		);

		expect(dependencies.uploadUpdates).not.toHaveBeenCalled();
		expect(dependencies.uploadNewFiles).not.toHaveBeenCalled();
		expect(dependencies.deleteRemoteFiles).not.toHaveBeenCalled();
	});

	it("does not execute upload steps while sync is locked", async () => {
		SyncActiveStore.update((state) => {
			state.locked = true;
		});
		const dependencies = makeDependencies(jest.fn().mockReturnValue(true));

		await createSyncPipeline(dependencies)(
			{
				name: "Main",
				localPath: "local/sync",
				remotePath: "aws/sync",
				direction: "bi",
				uploadsRole: "admin",
			},
			"admin",
			"user-1",
		);

		expect(dependencies.uploadUpdates).not.toHaveBeenCalled();
		expect(dependencies.addSyncLog).toHaveBeenCalledWith(
			"Uploads skipped (Sync is Locked)",
			"warning",
		);
	});

	it("blocks manifest publication and remote removal after a partial upload", async () => {
		const dependencies = makeDependencies(jest.fn().mockReturnValue(true));
		dependencies.updateLocalManifest.mockResolvedValue([
			{ path: "/deleted.json", version: "2", deleted: true },
		]);
		dependencies.downloadUpdates.mockResolvedValue({
			manifest: [{ path: "/deleted.json", version: "2", deleted: true }],
			hasChanges: false,
			complete: true,
		});
		dependencies.removeDeletedFiles.mockResolvedValue({
			manifest: [{ path: "/deleted.json", version: "2", deleted: true }],
			hasChanges: false,
		});
		dependencies.uploadUpdates.mockResolvedValue({
			manifest: [],
			hasChanges: false,
			complete: false,
		});

		const result = await createSyncPipeline(dependencies)(
			{
				name: "Main",
				localPath: "local/sync",
				remotePath: "aws/sync",
				direction: "bi",
				uploadsRole: "admin",
			},
			"admin",
			"user-1",
		);

		expect(result.complete).toBe(false);
		expect(dependencies.uploadManifest).not.toHaveBeenCalled();
		expect(dependencies.deleteRemoteFiles).not.toHaveBeenCalled();
		expect(dependencies.addSyncLog).toHaveBeenCalledWith(
			"Remote files retained because deletion safety checks did not pass",
			"warning",
		);
	});

	it("does not apply remote tombstones after an incomplete download", async () => {
		const dependencies = makeDependencies(jest.fn().mockReturnValue(false));
		const remoteManifest = [
			{ path: "/deleted.json", version: "3", deleted: true },
		];
		remoteManifest.loadedFromManifest = true;
		dependencies.syncManifest.mockResolvedValue(remoteManifest);
		dependencies.downloadUpdates.mockResolvedValue({
			manifest: [],
			hasChanges: false,
			complete: false,
			cleanedRemoteManifest: remoteManifest,
		});

		const result = await createSyncPipeline(dependencies)(
			{
				name: "Main",
				localPath: "local/sync",
				remotePath: "aws/sync",
				direction: "bi",
				uploadsRole: "admin",
			},
			"student",
			"user-1",
		);

		expect(result.complete).toBe(false);
		expect(dependencies.applyRemoteTombstones).not.toHaveBeenCalled();
	});

	it("blocks deletion when remote discovery is not authoritative", async () => {
		const dependencies = makeDependencies(jest.fn().mockReturnValue(true));
		const remoteManifest = [];
		remoteManifest.loadedFromManifest = false;
		remoteManifest.authoritative = false;
		dependencies.syncManifest.mockResolvedValue(remoteManifest);
		const tombstones = [{ path: "/deleted.json", version: "2", deleted: true }];
		dependencies.updateLocalManifest.mockResolvedValue(tombstones);
		dependencies.downloadUpdates.mockResolvedValue({
			manifest: tombstones,
			hasChanges: false,
			complete: true,
		});
		dependencies.removeDeletedFiles.mockResolvedValue({
			manifest: tombstones,
			hasChanges: false,
		});

		await createSyncPipeline(dependencies)(
			{
				name: "Personal",
				localPath: "local/personal",
				remotePath: "aws/personal/{userid}",
				direction: "bi",
				uploadsRole: "student",
			},
			"student",
			"user-1",
		);

		expect(dependencies.deleteRemoteFiles).not.toHaveBeenCalled();
		expect(dependencies.addSyncLog).toHaveBeenCalledWith(
			"Remote files retained because deletion safety checks did not pass",
			"warning",
		);
	});
});
