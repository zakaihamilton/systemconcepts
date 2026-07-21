import { readGroups } from "@sync/groups";
import { calculateHash } from "@sync/hash";
import { addSyncLog } from "@sync/logs";
import { SyncActiveStore } from "@sync/syncState";
import storage from "@util/storage/storage";
import { migrateFromMongoDB } from "./migrateFromMongoDB";

jest.mock("@util/storage/storage", () => ({
	__esModule: true,
	default: {
		exists: jest.fn(),
		readFile: jest.fn(),
		writeFile: jest.fn(),
		deleteFile: jest.fn(),
		getRecursiveList: jest.fn(),
		readFiles: jest.fn(),
		createFolderPath: jest.fn(),
	},
}));

jest.mock("@sync/groups", () => ({ readGroups: jest.fn() }));
jest.mock("@sync/hash", () => ({ calculateHash: jest.fn() }));
jest.mock("@sync/logs", () => ({ addSyncLog: jest.fn() }));
jest.mock("@util/api/logger", () => ({
	logger: { error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

const LOCAL_PATH = "local/personal";

describe("migrateFromMongoDB", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		storage.exists.mockResolvedValue(false);
		storage.writeFile.mockResolvedValue(undefined);
		storage.deleteFile.mockResolvedValue(undefined);
		storage.createFolderPath.mockResolvedValue(undefined);
		calculateHash.mockImplementation(
			async (str) => `hash-${String(str).length}`,
		);
		readGroups.mockResolvedValue({
			groups: [
				{ name: "Split" },
				{ name: "Bundled", bundled: true },
				{ name: "Merged", merged: true },
			],
		});
		SyncActiveStore.update((s) => {
			s.personalSyncProgress = null;
		});
	});

	it("skips migration entirely when remote manifest already has migration.json", async () => {
		const result = await migrateFromMongoDB(
			"user-1",
			[{ path: "/migration.json" }],
			LOCAL_PATH,
			true,
		);

		expect(result).toEqual({
			migrated: false,
			fileCount: 0,
			manifest: null,
			deletedKeys: [],
		});
		expect(storage.exists).not.toHaveBeenCalled();
	});

	it("marks migration complete without scanning when MongoDB has no personal folder", async () => {
		storage.exists.mockResolvedValue(false);

		const result = await migrateFromMongoDB("user-1", [], LOCAL_PATH, true);

		expect(result).toEqual({ migrated: false, fileCount: 0 });
		expect(storage.writeFile).toHaveBeenCalledWith(
			"/local/personal/migration.json",
			expect.stringContaining('"complete": true'),
		);
	});

	it("marks migration complete when MongoDB folder exists but has no files", async () => {
		storage.exists.mockImplementation(
			async (path) => path === "personal/metadata/sessions",
		);
		storage.getRecursiveList.mockResolvedValue([]);

		const result = await migrateFromMongoDB("user-1", [], LOCAL_PATH, true);

		expect(result).toEqual({ migrated: false, fileCount: 0 });
	});

	it("treats a corrupted migration.json as fresh state and deletes the bad file", async () => {
		storage.exists.mockImplementation(async (path) => {
			if (path === "/local/personal/migration.json") return true;
			if (path === "personal/metadata/sessions") return false;
			return false;
		});
		storage.readFile.mockImplementation(async (path) => {
			if (path === "/local/personal/migration.json") return "{not json";
			return null;
		});

		const result = await migrateFromMongoDB("user-1", [], LOCAL_PATH, true);

		expect(storage.deleteFile).toHaveBeenCalledWith(
			"/local/personal/migration.json",
		);
		expect(result).toEqual({ migrated: false, fileCount: 0 });
	});

	it("re-migrates when marked complete locally but both local and remote are empty", async () => {
		storage.exists.mockImplementation(async (path) => {
			if (path === "/local/personal/migration.json") return true;
			if (path === "personal/metadata/sessions") return true;
			return false;
		});
		storage.readFile.mockImplementation(async (path) => {
			if (path === "/local/personal/migration.json") {
				return JSON.stringify({
					complete: true,
					migrated: { "personal/metadata/sessions/Split/2024/a.json": true },
					files: [{ path: "/personal/metadata/sessions/Split/2024/a.json" }],
				});
			}
			return null;
		});
		storage.getRecursiveList.mockResolvedValue([]);

		const result = await migrateFromMongoDB("user-1", [], LOCAL_PATH, true);

		// No remote json and no local json => zombie-state repair kicks in and
		// re-attempts migration (which then fails to read batch content).
		expect(result.migrated).toBe(false);
		expect(result.fileCount).toBe(0);
	});

	it("keeps waiting for upload when marked complete locally with local files still pending", async () => {
		storage.exists.mockImplementation(async (path) => {
			if (path === "/local/personal/migration.json") return true;
			return false;
		});
		storage.readFile.mockResolvedValue(
			JSON.stringify({
				complete: true,
				migrated: {},
				files: [],
			}),
		);
		storage.getRecursiveList.mockResolvedValue([
			{ name: "a.json", path: "/local/personal/a.json" },
		]);

		const result = await migrateFromMongoDB("user-1", [], LOCAL_PATH, true);

		expect(result).toEqual({
			migrated: false,
			fileCount: 0,
			manifest: null,
			deletedKeys: [],
		});
	});

	it("skips remote verification and reports complete when read-only and locally complete", async () => {
		storage.exists.mockImplementation(async (path) => {
			if (path === "/local/personal/migration.json") return true;
			return false;
		});
		storage.readFile.mockResolvedValue(
			JSON.stringify({ complete: true, migrated: {}, files: [] }),
		);

		const result = await migrateFromMongoDB("user-1", [], LOCAL_PATH, false);

		expect(result).toEqual({
			migrated: false,
			fileCount: 0,
			manifest: null,
			deletedKeys: [],
		});
		expect(storage.getRecursiveList).not.toHaveBeenCalled();
	});

	it("reports complete immediately when remote confirms completion", async () => {
		storage.exists.mockImplementation(async (path) => {
			if (path === "/local/personal/migration.json") return true;
			return false;
		});
		storage.readFile.mockResolvedValue(
			JSON.stringify({ complete: true, migrated: {}, files: [] }),
		);

		const result = await migrateFromMongoDB(
			"user-1",
			[{ path: "/other.json" }],
			LOCAL_PATH,
			true,
		);

		expect(result).toEqual({
			migrated: false,
			fileCount: 0,
			manifest: null,
			deletedKeys: [],
		});
	});

	it("migrates split-group files into year bundles and writes the local manifest", async () => {
		const filePath = "/personal/metadata/sessions/Split/2024/a.json";
		storage.exists.mockImplementation(async (path) => {
			if (path === "personal/metadata/sessions") return true;
			return false;
		});
		storage.getRecursiveList.mockResolvedValue([
			{ type: "file", name: "a.json", path: filePath },
		]);
		storage.readFiles.mockResolvedValue({
			"/metadata/sessions/Split/2024/a.json": JSON.stringify({ title: "A" }),
		});

		const result = await migrateFromMongoDB("user-1", [], LOCAL_PATH, true);

		expect(result.migrated).toBe(true);
		expect(result.fileCount).toBe(1);
		expect(storage.writeFile).toHaveBeenCalledWith(
			"/local/personal/Split/2024.json",
			JSON.stringify({ "a.json": { title: "A" } }, null, 4),
		);
		expect(result.manifest.some((e) => e.path === "/Split/2024.json")).toBe(
			true,
		);
	});

	it("migrates bundled-group files into the shared bundle.json", async () => {
		const filePath = "/personal/metadata/sessions/Bundled/session1.json";
		storage.exists.mockImplementation(async (path) => {
			if (path === "personal/metadata/sessions") return true;
			return false;
		});
		storage.getRecursiveList.mockResolvedValue([
			{ type: "file", name: "session1.json", path: filePath },
		]);
		storage.readFiles.mockResolvedValue({
			"/metadata/sessions/Bundled/session1.json": JSON.stringify({
				title: "B",
			}),
		});

		const result = await migrateFromMongoDB("user-1", [], LOCAL_PATH, true);

		expect(result.migrated).toBe(true);
		expect(storage.writeFile).toHaveBeenCalledWith(
			"/local/personal/bundle.json",
			expect.stringContaining("Bundled/session1.json"),
		);
	});

	it("migrates merged-group files into a per-group manifest, stripping the group prefix", async () => {
		const filePath = "/personal/metadata/sessions/Merged/session1.json";
		storage.exists.mockImplementation(async (path) => {
			if (path === "personal/metadata/sessions") return true;
			return false;
		});
		storage.getRecursiveList.mockResolvedValue([
			{ type: "file", name: "session1.json", path: filePath },
		]);
		storage.readFiles.mockResolvedValue({
			"/metadata/sessions/Merged/session1.json": JSON.stringify({
				title: "M",
			}),
		});

		const result = await migrateFromMongoDB("user-1", [], LOCAL_PATH, true);

		expect(storage.writeFile).toHaveBeenCalledWith(
			"/local/personal/Merged.json",
			JSON.stringify({ "session1.json": { title: "M" } }, null, 4),
		);
		expect(result.migrated).toBe(true);
	});

	it("skips files whose group no longer exists, without failing the migration", async () => {
		const filePath = "/personal/metadata/sessions/Unknown/a.json";
		storage.exists.mockImplementation(async (path) => {
			if (path === "personal/metadata/sessions") return true;
			return false;
		});
		storage.getRecursiveList.mockResolvedValue([
			{ type: "file", name: "a.json", path: filePath },
		]);
		storage.readFiles.mockResolvedValue({});

		const result = await migrateFromMongoDB("user-1", [], LOCAL_PATH, true);

		expect(result.fileCount).toBe(0);
		expect(result.migrated).toBe(false);
	});

	it("skips empty file contents returned from the batch read", async () => {
		const filePath = "/personal/metadata/sessions/Split/2024/empty.json";
		storage.exists.mockImplementation(async (path) => {
			if (path === "personal/metadata/sessions") return true;
			return false;
		});
		storage.getRecursiveList.mockResolvedValue([
			{ type: "file", name: "empty.json", path: filePath },
		]);
		storage.readFiles.mockResolvedValue({
			"/metadata/sessions/Split/2024/empty.json": "   ",
		});

		const result = await migrateFromMongoDB("user-1", [], LOCAL_PATH, true);

		expect(result.fileCount).toBe(0);
	});

	it("continues without marking migrated when a batch read fails entirely", async () => {
		const filePath = "/personal/metadata/sessions/Split/2024/a.json";
		storage.exists.mockImplementation(async (path) => {
			if (path === "personal/metadata/sessions") return true;
			return false;
		});
		storage.getRecursiveList.mockResolvedValue([
			{ type: "file", name: "a.json", path: filePath },
		]);
		storage.readFiles.mockRejectedValue(new Error("batch read failed"));

		const result = await migrateFromMongoDB("user-1", [], LOCAL_PATH, true);

		expect(result.fileCount).toBe(0);
		expect(addSyncLog).toHaveBeenCalledWith(
			expect.stringContaining("Failed"),
			"error",
		);
	});

	it("links merged-group files to an existing remote bundle instead of re-migrating them", async () => {
		const filePath = "/personal/metadata/sessions/Merged/session1.json";
		storage.exists.mockImplementation(async (path) => {
			if (path === "personal/metadata/sessions") return true;
			return false;
		});
		storage.getRecursiveList.mockResolvedValue([
			{ type: "file", name: "session1.json", path: filePath },
		]);

		const result = await migrateFromMongoDB(
			"user-1",
			[{ path: "Merged.json" }],
			LOCAL_PATH,
			true,
		);

		expect(result).toEqual({
			migrated: false,
			fileCount: 0,
			manifest: null,
			deletedKeys: [],
		});
		expect(addSyncLog).toHaveBeenCalledWith(
			expect.stringContaining("Linked 1 files"),
			"info",
		);
	});

	it("returns a graceful error result when writing migration state fails unexpectedly", async () => {
		storage.exists.mockImplementation(async (path) => {
			if (path === "personal/metadata/sessions") return true;
			return false;
		});
		storage.getRecursiveList.mockRejectedValue(new Error("listing failed"));

		const result = await migrateFromMongoDB("user-1", [], LOCAL_PATH, true);

		expect(result.migrated).toBe(false);
		expect(result.error).toBeInstanceOf(Error);
		expect(addSyncLog).toHaveBeenCalledWith(
			expect.stringContaining("Migration failed"),
			"error",
		);
	});

	it("treats an empty migration file as corrupt and starts fresh", async () => {
		storage.exists.mockImplementation(async (path) => {
			if (path === "/local/personal/migration.json") return true;
			if (path === "personal/metadata/sessions") return false;
			return false;
		});
		storage.readFile.mockResolvedValue("   ");

		const result = await migrateFromMongoDB("user-1", [], LOCAL_PATH, true);
		expect(storage.deleteFile).toHaveBeenCalled();
		expect(result.migrated).toBe(false);
	});

	it("continues when readGroups fails during bundling checks", async () => {
		readGroups.mockRejectedValue(new Error("groups unavailable"));
		storage.exists.mockImplementation(async (path) => {
			if (path === "personal/metadata/sessions") return true;
			return false;
		});
		storage.getRecursiveList.mockResolvedValue([
			{
				type: "file",
				name: "a.json",
				path: "/personal/metadata/sessions/Split/2024/a.json",
			},
		]);
		storage.readFiles.mockResolvedValue({});

		const result = await migrateFromMongoDB("user-1", [], LOCAL_PATH, true);
		expect(result.fileCount).toBe(0);
	});

	it("accepts migration.json without a leading slash in the remote manifest", async () => {
		const result = await migrateFromMongoDB(
			"user-1",
			[{ path: "migration.json" }],
			LOCAL_PATH,
			true,
		);
		expect(result.migrated).toBe(false);
		expect(storage.exists).not.toHaveBeenCalled();
	});

	it("filters out directories and .DS_Store files while scanning", async () => {
		storage.exists.mockImplementation(async (path) => {
			if (path === "personal/metadata/sessions") return true;
			return false;
		});
		storage.getRecursiveList.mockResolvedValue([
			{
				type: "dir",
				name: "subdir",
				path: "/personal/metadata/sessions/subdir",
			},
			{
				type: "file",
				name: ".DS_Store",
				path: "/personal/metadata/sessions/.DS_Store",
			},
			{ type: "file", name: "   ", path: "/personal/metadata/sessions/blank" },
		]);

		const result = await migrateFromMongoDB("user-1", [], LOCAL_PATH, true);
		expect(result).toEqual({ migrated: false, fileCount: 0 });
	});

	it("merges an existing local manifest when present", async () => {
		const filePath = "/personal/metadata/sessions/Split/2024/a.json";
		storage.exists.mockImplementation(async (path) => {
			if (path === "personal/metadata/sessions") return true;
			if (path === "/local/personal/files.json") return true;
			return false;
		});
		storage.getRecursiveList.mockResolvedValue([
			{ type: "file", name: "a.json", path: filePath },
		]);
		storage.readFiles.mockResolvedValue({
			"/metadata/sessions/Split/2024/a.json": JSON.stringify({ title: "A" }),
		});
		storage.readFile.mockImplementation(async (path) => {
			if (path === "/local/personal/files.json") {
				return JSON.stringify([{ path: "/old.json", version: 1 }]);
			}
			return null;
		});

		const result = await migrateFromMongoDB("user-1", [], LOCAL_PATH, true);
		expect(result.migrated).toBe(true);
		expect(result.manifest.some((e) => e.path === "/old.json")).toBe(true);
	});

	it("links bundled-group files to an existing remote bundle.json", async () => {
		const filePath = "/personal/metadata/sessions/Bundled/session1.json";
		storage.exists.mockImplementation(async (path) => {
			if (path === "personal/metadata/sessions") return true;
			return false;
		});
		storage.getRecursiveList.mockResolvedValue([
			{ type: "file", name: "session1.json", path: filePath },
		]);

		const result = await migrateFromMongoDB(
			"user-1",
			[{ path: "bundle.json" }],
			LOCAL_PATH,
			true,
		);

		expect(result.migrated).toBe(false);
		expect(addSyncLog).toHaveBeenCalledWith(
			expect.stringContaining("Linked 1 files"),
			"info",
		);
	});

	it("handles a non-array remoteManifest safely", async () => {
		storage.exists.mockResolvedValue(false);
		const result = await migrateFromMongoDB("user-1", null, LOCAL_PATH, true);
		expect(result.migrated).toBe(false);
	});

	it("warns when migration state cannot be written", async () => {
		const { logger } = require("@util/api/logger");
		storage.getRecursiveList.mockResolvedValue([
			{ name: "note.txt", path: "mongo/personal/note.txt", type: "file" },
		]);
		storage.readFiles.mockResolvedValue([
			{ path: "mongo/personal/note.txt", content: '{"ok":true}' },
		]);
		storage.writeFile.mockImplementation(async (path) => {
			if (String(path).includes("migration.json")) {
				throw new Error("write failed");
			}
		});

		const result = await migrateFromMongoDB("user-1", [], LOCAL_PATH, true);

		expect(result.error).toBeTruthy();
		expect(logger.error).toHaveBeenCalled();
	});

	it("marks unknown-group files as migrated without copying them", async () => {
		storage.getRecursiveList.mockResolvedValue([
			{
				name: "2024-01-01 Unknown.txt",
				path: "personal/metadata/sessions/Unknown/2024/2024-01-01 Unknown.txt",
				type: "file",
			},
		]);
		storage.readFiles.mockResolvedValue([
			{
				path: "personal/metadata/sessions/Unknown/2024/2024-01-01 Unknown.txt",
				content: "session body",
			},
		]);

		const result = await migrateFromMongoDB("user-1", [], LOCAL_PATH, true);

		expect(result.migrated).toBe(false);
	});

	it("resumes migration when complete state is a zombie with empty local and remote data", async () => {
		const migrationPath = "/local/personal/migration.json";
		storage.exists.mockImplementation(async (path) => {
			if (path === migrationPath) return true;
			if (path === "personal/metadata/sessions") return true;
			return false;
		});
		storage.readFile.mockImplementation(async (path) => {
			if (path === migrationPath) {
				return JSON.stringify({
					complete: true,
					migrated: {},
					files: [],
				});
			}
			return null;
		});
		storage.getRecursiveList.mockImplementation(async (path) => {
			if (path === LOCAL_PATH) return [];
			if (path === "personal/metadata/sessions") {
				return [
					{
						type: "file",
						name: "a.json",
						path: "/personal/metadata/sessions/Split/2024/a.json",
					},
				];
			}
			return [];
		});
		storage.readFiles.mockResolvedValue({
			"/metadata/sessions/Split/2024/a.json": JSON.stringify({ title: "A" }),
		});

		const result = await migrateFromMongoDB("user-1", [], LOCAL_PATH, true);
		expect(result.migrated).toBe(true);
		expect(result.fileCount).toBe(1);
	});

	it("skips remote verification when migration is complete and uploads are disabled", async () => {
		const migrationPath = "/local/personal/migration.json";
		storage.exists.mockImplementation(async (path) => path === migrationPath);
		storage.readFile.mockResolvedValue(
			JSON.stringify({ complete: true, migrated: {}, files: [] }),
		);

		const result = await migrateFromMongoDB("user-1", [], LOCAL_PATH, false);
		expect(result).toEqual({
			migrated: false,
			fileCount: 0,
			manifest: null,
			deletedKeys: [],
		});
	});

	it("restarts from scratch when migration state cannot be parsed", async () => {
		const migrationPath = "/local/personal/migration.json";
		storage.exists.mockImplementation(async (path) => {
			if (path === migrationPath) return true;
			if (path === "personal/metadata/sessions") return false;
			return false;
		});
		storage.readFile.mockImplementation(async (path) => {
			if (path === migrationPath) return "{bad";
			return null;
		});

		const result = await migrateFromMongoDB("user-1", [], LOCAL_PATH, true);
		expect(storage.deleteFile).toHaveBeenCalledWith(migrationPath);
		expect(result.migrated).toBe(false);
	});

	it("links split-group files to an existing remote manifest entry", async () => {
		const filePath = "/personal/metadata/sessions/Split/2024/a.json";
		storage.exists.mockImplementation(async (path) => {
			if (path === "personal/metadata/sessions") return true;
			return false;
		});
		storage.getRecursiveList.mockResolvedValue([
			{ type: "file", name: "a.json", path: filePath },
		]);

		const result = await migrateFromMongoDB(
			"user-1",
			[{ path: "Split/2024/a.json" }],
			LOCAL_PATH,
			true,
		);

		expect(result.migrated).toBe(false);
		expect(addSyncLog).toHaveBeenCalledWith(
			expect.stringContaining("Linked 1 files"),
			"info",
		);
	});

	it("skips split files without a year segment", async () => {
		storage.exists.mockImplementation(async (path) => {
			if (path === "personal/metadata/sessions") return true;
			return false;
		});
		storage.getRecursiveList.mockResolvedValue([
			{
				type: "file",
				name: "Split",
				path: "/personal/metadata/sessions/Split",
			},
		]);
		storage.readFiles.mockResolvedValue({
			"/metadata/sessions/Split": JSON.stringify({ ok: true }),
		});

		const result = await migrateFromMongoDB("user-1", [], LOCAL_PATH, true);

		expect(result.fileCount).toBe(0);
	});

	it("skips corrupted bundled JSON without failing the batch", async () => {
		const filePath = "/personal/metadata/sessions/Bundled/session1.json";
		storage.exists.mockImplementation(async (path) => {
			if (path === "personal/metadata/sessions") return true;
			return false;
		});
		storage.getRecursiveList.mockResolvedValue([
			{ type: "file", name: "session1.json", path: filePath },
		]);
		storage.readFiles.mockResolvedValue({
			"/metadata/sessions/Bundled/session1.json": "{bad json",
		});

		const result = await migrateFromMongoDB("user-1", [], LOCAL_PATH, true);

		expect(result.fileCount).toBe(1);
		expect(result.migrated).toBe(true);
	});

	it("repairs double-slash manifest entries and re-queues affected files", async () => {
		const filePath = "/personal/metadata/sessions/Split/2024/a.json";
		storage.exists.mockImplementation(async (path) => {
			if (path === "/local/personal/migration.json") return true;
			if (path === "personal/metadata/sessions") return true;
			return false;
		});
		storage.readFile.mockImplementation(async (path) => {
			if (path === "/local/personal/migration.json") {
				return JSON.stringify({
					complete: false,
					migrated: {},
					files: [{ path: filePath }],
				});
			}
			return null;
		});
		storage.getRecursiveList.mockResolvedValue([
			{ type: "file", name: "a.json", path: filePath },
		]);
		storage.readFiles.mockResolvedValue({
			"/metadata/sessions/Split/2024/a.json": JSON.stringify({ title: "A" }),
		});

		const result = await migrateFromMongoDB(
			"user-1",
			[{ path: "metadata/sessions//Split/2024/a.json", version: 1 }],
			LOCAL_PATH,
			true,
		);

		expect(result.deletedKeys).toContain(
			"metadata/sessions//Split/2024/a.json",
		);
		expect(result.fileCount).toBe(1);
	});
});
