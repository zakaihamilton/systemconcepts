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

	it("skips local hashing when library counter is unchanged", async () => {
		const dependencies = makeDependencies(jest.fn().mockReturnValue(true));
		dependencies.readLibraryCounter.mockResolvedValue(5);
		dependencies.getSavedLibraryCounter.mockReturnValue(5);
		dependencies.storage.readFile = jest.fn().mockResolvedValue(
			JSON.stringify([
				{ path: "/a.json", deleted: false },
				{ path: "/b.json", deleted: true },
			]),
		);

		await createSyncPipeline(dependencies)(
			{
				name: "Library",
				localPath: "local/library",
				remotePath: "aws/library",
				direction: "bi",
				uploadsRole: "admin",
				useChangeCounter: true,
			},
			"admin",
			"user-1",
		);

		expect(dependencies.getLocalFiles).not.toHaveBeenCalled();
		expect(dependencies.addSyncLog).toHaveBeenCalledWith(
			expect.stringContaining("Library counter unchanged"),
			"info",
		);
		expect(dependencies.saveLibraryCounter).toHaveBeenCalledWith(5);
		expect(dependencies.updateLocalManifest).toHaveBeenCalledWith(
			[{ path: "/a.json", fullPath: expect.stringContaining("/a.json") }],
			"local/library",
			expect.anything(),
			{ skipHashing: true },
		);
	});

	it("rescans library files when the counter changes", async () => {
		const dependencies = makeDependencies(jest.fn().mockReturnValue(true));
		dependencies.readLibraryCounter
			.mockResolvedValueOnce(7)
			.mockResolvedValueOnce(8);
		dependencies.getSavedLibraryCounter.mockReturnValue(3);
		dependencies.storage.readFile = jest
			.fn()
			.mockResolvedValue(JSON.stringify([{ path: "/a.json" }]));
		const prior = SyncActiveStore.getRawState().libraryUpdateCounter || 0;

		await createSyncPipeline(dependencies)(
			{
				name: "Library",
				localPath: "local/library",
				remotePath: "aws/library",
				direction: "bi",
				uploadsRole: "admin",
				useChangeCounter: true,
			},
			"admin",
			"user-1",
		);

		expect(dependencies.getLocalFiles).toHaveBeenCalled();
		expect(dependencies.addSyncLog).toHaveBeenCalledWith(
			expect.stringContaining("Library counter changed"),
			"info",
		);
		expect(dependencies.saveLibraryCounter).toHaveBeenCalledWith(8);
		expect(SyncActiveStore.getRawState().libraryUpdateCounter).toBe(prior + 1);
	});

	it("warns when cached library manifest cannot be read", async () => {
		const dependencies = makeDependencies(jest.fn().mockReturnValue(true));
		dependencies.readLibraryCounter.mockResolvedValue(1);
		dependencies.getSavedLibraryCounter.mockReturnValue(null);
		dependencies.storage.readFile = jest
			.fn()
			.mockRejectedValue(new Error("bad manifest"));

		await createSyncPipeline(dependencies)(
			{
				name: "Library",
				localPath: "local/library",
				remotePath: "aws/library",
				direction: "pull",
				uploadsRole: "admin",
				useChangeCounter: true,
			},
			"admin",
			"user-1",
		);

		expect(dependencies.logger.warn).toHaveBeenCalledWith(
			"[Sync] Failed to read cached local manifest:",
			expect.any(Error),
		);
	});
	it("runs migration and merges FORCE_UPLOAD entries", async () => {
		const dependencies = makeDependencies(jest.fn().mockReturnValue(true));
		dependencies.migrateFromMongoDB.mockResolvedValue({
			migrated: true,
			fileCount: 2,
			deletedKeys: ["/old.json"],
			manifest: [
				{ path: "/new.json", version: 2 },
				{ path: "/keep.json", version: 1 },
			],
		});
		const remoteManifest = [
			{ path: "/old.json", version: "1" },
			{ path: "/keep.json", version: "1" },
		];
		remoteManifest.loadedFromManifest = true;
		remoteManifest.authoritative = true;
		dependencies.syncManifest.mockResolvedValue(remoteManifest);

		await createSyncPipeline(dependencies)(
			{
				name: "Personal",
				localPath: "local/personal",
				remotePath: "aws/personal/{userid}",
				direction: "bi",
				uploadsRole: "student",
				migration: true,
			},
			"student",
			"user-1",
		);

		expect(dependencies.migrateFromMongoDB).toHaveBeenCalled();
		expect(dependencies.addSyncLog).toHaveBeenCalledWith(
			expect.stringContaining("Migration complete"),
			"success",
		);
		expect(dependencies.getLocalFiles).toHaveBeenCalledTimes(2);
		expect(dependencies.uploadManifest).toHaveBeenCalled();
	});

	it("marks phase incomplete when migration throws", async () => {
		const dependencies = makeDependencies(jest.fn().mockReturnValue(true));
		dependencies.migrateFromMongoDB.mockRejectedValue(
			new Error("migrate boom"),
		);

		const result = await createSyncPipeline(dependencies)(
			{
				name: "Personal",
				localPath: "local/personal",
				remotePath: "aws/personal/{userid}",
				direction: "bi",
				uploadsRole: "student",
				migration: true,
			},
			"student",
			"user-1",
		);

		expect(result.complete).toBe(false);
		expect(dependencies.addSyncLog).toHaveBeenCalledWith(
			"Migration failed: migrate boom",
			"error",
		);
	});

	it("applies local tombstones and deletes remotes when deletion is safe", async () => {
		const dependencies = makeDependencies(jest.fn().mockReturnValue(true));
		const tombstones = [{ path: "/gone.json", version: "2", deleted: true }];
		dependencies.updateLocalManifest.mockResolvedValue(tombstones);
		dependencies.downloadUpdates.mockResolvedValue({
			manifest: tombstones,
			hasChanges: true,
			complete: true,
		});
		dependencies.removeDeletedFiles.mockResolvedValue({
			manifest: tombstones,
			hasChanges: false,
		});
		dependencies.uploadUpdates.mockResolvedValue({
			manifest: [],
			hasChanges: false,
			complete: true,
		});
		dependencies.uploadNewFiles.mockResolvedValue({
			manifest: [],
			hasChanges: false,
			complete: true,
		});
		dependencies.deleteRemoteFiles.mockResolvedValue({ complete: true });

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

		expect(result.complete).toBe(true);
		expect(dependencies.deleteRemoteFiles).toHaveBeenCalled();
		expect(dependencies.uploadManifest).toHaveBeenCalled();
	});

	it("skips manifest upload when nothing changed and manifest was loaded", async () => {
		const dependencies = makeDependencies(jest.fn().mockReturnValue(true));
		dependencies.downloadUpdates.mockResolvedValue({
			manifest: [],
			hasChanges: false,
			complete: true,
		});

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

		expect(dependencies.uploadManifest).not.toHaveBeenCalled();
		expect(dependencies.logger.debug).toHaveBeenCalledWith(
			expect.stringContaining("Skipping manifest upload"),
		);
	});

	it("applies remote tombstones when local deletion is safe", async () => {
		const dependencies = makeDependencies(jest.fn().mockReturnValue(false));
		const remoteManifest = [
			{ path: "/remote-gone.json", version: "3", deleted: true },
		];
		remoteManifest.loadedFromManifest = true;
		remoteManifest.authoritative = true;
		dependencies.syncManifest.mockResolvedValue(remoteManifest);
		dependencies.downloadUpdates.mockResolvedValue({
			manifest: [],
			hasChanges: false,
			complete: true,
			cleanedRemoteManifest: remoteManifest,
		});
		dependencies.applyRemoteTombstones.mockResolvedValue({
			manifest: [],
			hasChanges: true,
			complete: true,
		});

		const result = await createSyncPipeline(dependencies)(
			{
				name: "Main",
				localPath: "local/sync",
				remotePath: "aws/sync",
				direction: "pull",
				uploadsRole: "admin",
			},
			"student",
			"user-1",
		);

		expect(dependencies.applyRemoteTombstones).toHaveBeenCalled();
		expect(result.hasChanges).toBe(true);
	});

	it("warns about insufficient upload permissions when unlocked", async () => {
		const dependencies = makeDependencies(jest.fn().mockReturnValue(false));

		await createSyncPipeline(dependencies)(
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

		expect(dependencies.addSyncLog).toHaveBeenCalledWith(
			expect.stringContaining("Insufficient permissions"),
			"warning",
		);
	});

	it("merges migrated manifest entries and filters deleted remote keys", async () => {
		const dependencies = makeDependencies(jest.fn().mockReturnValue(true));
		const remoteManifest = [
			{ path: "old-key.json", version: 1 },
			{ path: "keep.json", version: 1 },
		];
		remoteManifest.loadedFromManifest = true;
		remoteManifest.authoritative = true;
		dependencies.syncManifest.mockResolvedValue(remoteManifest);
		dependencies.migrateFromMongoDB.mockResolvedValue({
			migrated: true,
			fileCount: 2,
			deletedKeys: ["old-key.json"],
			manifest: [{ path: "new-local.json", version: 2 }],
		});
		dependencies.getLocalFiles
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([
				{ path: "/new-local.json", fullPath: "/local/personal/new-local.json" },
			]);

		await createSyncPipeline(dependencies)(
			{
				name: "Personal",
				localPath: "local/personal",
				remotePath: "aws/personal/{userid}",
				direction: "bi",
				uploadsRole: "student",
				migration: true,
			},
			"student",
			"user-1",
		);

		expect(dependencies.addSyncLog).toHaveBeenCalledWith(
			expect.stringContaining("Migration complete: 2 files"),
			"success",
		);
		expect(dependencies.getLocalFiles).toHaveBeenCalledTimes(2);
	});

	it("logs migration failures without aborting the rest of the pipeline", async () => {
		const dependencies = makeDependencies(jest.fn().mockReturnValue(true));
		dependencies.migrateFromMongoDB.mockRejectedValue(
			new Error("migration boom"),
		);

		const result = await createSyncPipeline(dependencies)(
			{
				name: "Personal",
				localPath: "local/personal",
				remotePath: "aws/personal/{userid}",
				direction: "bi",
				uploadsRole: "student",
				migration: true,
			},
			"student",
			"user-1",
		);

		expect(dependencies.logger.error).toHaveBeenCalledWith(
			expect.stringContaining("Migration failed"),
			expect.any(Error),
		);
		expect(dependencies.addSyncLog).toHaveBeenCalledWith(
			"Migration failed: migration boom",
			"error",
		);
		expect(result.complete).toBe(false);
	});
});
