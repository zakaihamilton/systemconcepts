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
		uploadManifest: jest.fn(),
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
});
