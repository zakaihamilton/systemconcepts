import storage from "@util/storage/storage";
import { TextEncoder } from "util";
import { addSyncLog } from "../logs";
import { SyncActiveStore } from "../syncState";
import { updateLocalManifest } from "./updateLocalManifest";

beforeAll(() => {
	global.TextEncoder = TextEncoder;
});

jest.mock("@util/storage/storage", () => ({
	__esModule: true,
	default: {
		readFile: jest.fn(),
		writeFile: jest.fn(),
	},
}));

jest.mock("../logs", () => ({ addSyncLog: jest.fn() }));

jest.mock("../mutex", () => ({
	lockMutex: jest.fn().mockResolvedValue(jest.fn()),
}));

describe("updateLocalManifest", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		storage.writeFile.mockResolvedValue(undefined);
		SyncActiveStore.update((state) => {
			state.stopping = false;
			state.progress = { total: 0, processed: 0 };
		});
	});

	it("adds a new file to an empty manifest, versioned above the remote entry", async () => {
		storage.readFile.mockResolvedValueOnce(null);
		storage.readFile.mockResolvedValueOnce("hello");

		const localFiles = [
			{ path: "/alpha.json", fullPath: "/local/sync/alpha.json" },
		];
		const remoteManifest = [{ path: "/alpha.json", version: "4" }];

		const manifest = await updateLocalManifest(
			localFiles,
			"local/sync",
			remoteManifest,
		);

		expect(manifest).toEqual([
			{ path: "/alpha.json", hash: "4f9f2cab", size: 5, version: "5" },
		]);
		expect(storage.writeFile).toHaveBeenCalledWith(
			"/local/sync/files.json",
			JSON.stringify(manifest, null, 4),
		);
	});

	it("bumps the version when an existing file's hash has changed", async () => {
		storage.readFile.mockResolvedValueOnce(
			JSON.stringify([
				{ path: "/alpha.json", hash: "old-hash", size: 3, version: "2" },
			]),
		);
		storage.readFile.mockResolvedValueOnce("hello");

		const localFiles = [
			{ path: "/alpha.json", fullPath: "/local/sync/alpha.json" },
		];
		const remoteManifest = [{ path: "/alpha.json", version: "4" }];

		const manifest = await updateLocalManifest(
			localFiles,
			"local/sync",
			remoteManifest,
		);

		expect(manifest[0]).toMatchObject({ hash: "4f9f2cab", version: "5" });
	});

	it("leaves the manifest unchanged when the hash matches and skips the disk write", async () => {
		storage.readFile.mockResolvedValueOnce(
			JSON.stringify([
				{ path: "/alpha.json", hash: "4f9f2cab", size: 5, version: "2" },
			]),
		);
		storage.readFile.mockResolvedValueOnce("hello");

		const localFiles = [
			{ path: "/alpha.json", fullPath: "/local/sync/alpha.json" },
		];

		const manifest = await updateLocalManifest(localFiles, "local/sync", []);

		expect(manifest[0].version).toBe("2");
		expect(storage.writeFile).not.toHaveBeenCalled();
	});

	it("marks a file as deleted when it disappears locally, then restores it when it returns", async () => {
		storage.readFile.mockResolvedValueOnce(
			JSON.stringify([
				{ path: "/gone.json", hash: "abc", size: 3, version: "2" },
			]),
		);

		const deletedManifest = await updateLocalManifest([], "local/sync", []);
		expect(deletedManifest[0]).toMatchObject({ deleted: true, version: "3" });

		jest.clearAllMocks();
		storage.writeFile.mockResolvedValue(undefined);
		storage.readFile.mockResolvedValueOnce(
			JSON.stringify([
				{
					path: "/gone.json",
					hash: "abc",
					size: 3,
					version: "3",
					deleted: true,
				},
			]),
		);
		storage.readFile.mockResolvedValueOnce("abc");

		const restoredManifest = await updateLocalManifest(
			[{ path: "/gone.json", fullPath: "/local/sync/gone.json" }],
			"local/sync",
			[],
		);
		expect(restoredManifest[0].deleted).toBeUndefined();
	});

	it("converts a legacy dictionary-style manifest into array form", async () => {
		storage.readFile.mockResolvedValueOnce(
			JSON.stringify({
				"/legacy.json": { hash: "abc", size: 1, version: "1" },
			}),
		);
		storage.readFile.mockResolvedValueOnce("abc");

		const manifest = await updateLocalManifest(
			[{ path: "/legacy.json", fullPath: "/local/sync/legacy.json" }],
			"local/sync",
			[],
		);

		expect(manifest[0].path).toBe("/legacy.json");
	});

	it("throws with a cause when the existing local manifest cannot be parsed", async () => {
		storage.readFile.mockResolvedValueOnce("{not json");

		await expect(updateLocalManifest([], "local/sync", [])).rejects.toThrow(
			"Invalid local sync manifest",
		);
		expect(addSyncLog).toHaveBeenCalledWith(
			expect.stringContaining("Step 2 failed"),
			"error",
		);
	});

	it("returns the manifest unchanged and skips hashing when skipHashing is set", async () => {
		const cached = [{ path: "/cached.json", hash: "x", version: "1" }];
		storage.readFile.mockResolvedValueOnce(JSON.stringify(cached));

		const manifest = await updateLocalManifest(
			[{ path: "/cached.json", fullPath: "/local/sync/cached.json" }],
			"local/sync",
			[],
			{ skipHashing: true },
		);

		expect(manifest).toEqual(cached);
		expect(storage.readFile).toHaveBeenCalledTimes(1);
	});

	it("stops hashing and throws a SYNC_STOPPED error when the user cancels", async () => {
		storage.readFile.mockResolvedValueOnce(null);
		SyncActiveStore.update((state) => {
			state.stopping = true;
		});

		const localFiles = [
			{ path: "/alpha.json", fullPath: "/local/sync/alpha.json" },
		];

		await expect(
			updateLocalManifest(localFiles, "local/sync", []),
		).rejects.toMatchObject({ code: "SYNC_STOPPED" });
		expect(addSyncLog).toHaveBeenCalledWith(
			"Hashing stopped by user",
			"warning",
		);
	});

	it("skips files whose content could not be read", async () => {
		storage.readFile.mockResolvedValueOnce(null);
		storage.readFile.mockResolvedValueOnce(null);

		const manifest = await updateLocalManifest(
			[{ path: "/missing-content.json", fullPath: "/local/sync/x.json" }],
			"local/sync",
			[],
		);

		expect(manifest).toEqual([]);
	});

	it("propagates a read failure while computing file info", async () => {
		storage.readFile.mockResolvedValueOnce(null);
		storage.readFile.mockRejectedValueOnce(new Error("disk error"));

		await expect(
			updateLocalManifest(
				[{ path: "/broken.json", fullPath: "/local/sync/broken.json" }],
				"local/sync",
				[],
			),
		).rejects.toThrow("disk error");
	});

	it("treats a null remote manifest like an empty list", async () => {
		storage.readFile.mockResolvedValueOnce(null);
		storage.readFile.mockResolvedValueOnce("hello");

		const manifest = await updateLocalManifest(
			[{ path: "/alpha.json", fullPath: "/local/sync/alpha.json" }],
			"local/sync",
			null,
		);

		expect(manifest[0].version).toBe("1");
	});

	it("does not re-mark files that are already deleted", async () => {
		storage.readFile.mockResolvedValueOnce(
			JSON.stringify([
				{
					path: "/gone.json",
					hash: "abc",
					size: 3,
					version: "3",
					deleted: true,
				},
			]),
		);

		const manifest = await updateLocalManifest([], "local/sync", []);

		expect(manifest[0]).toMatchObject({ deleted: true, version: "3" });
		expect(storage.writeFile).not.toHaveBeenCalled();
	});

	it("uses remote versions when bumping deleted file versions", async () => {
		storage.readFile.mockResolvedValueOnce(
			JSON.stringify([
				{ path: "/gone.json", hash: "abc", size: 3, version: "2" },
			]),
		);

		const manifest = await updateLocalManifest([], "local/sync", [
			{ path: "/gone.json", version: "9" },
		]);

		expect(manifest[0]).toMatchObject({ deleted: true, version: "10" });
	});

	it("stops mid-batch when the user cancels during hashing", async () => {
		storage.readFile.mockResolvedValueOnce(null);
		const localFiles = Array.from({ length: 3 }, (_v, i) => ({
			path: `/file-${i}.json`,
			fullPath: `/local/sync/file-${i}.json`,
		}));
		storage.readFile.mockImplementation(async (path) => {
			if (String(path).includes("file-1")) {
				SyncActiveStore.update((state) => {
					state.stopping = true;
				});
			}
			return "payload";
		});

		await expect(
			updateLocalManifest(localFiles, "local/sync", []),
		).rejects.toMatchObject({ code: "SYNC_STOPPED" });
	});

	it("logs the skip-hashing path and returns the cached manifest", async () => {
		const cached = [{ path: "/cached.json", hash: "x", version: "1" }];
		storage.readFile.mockResolvedValueOnce(JSON.stringify(cached));

		const manifest = await updateLocalManifest(
			[{ path: "/cached.json", fullPath: "/local/sync/cached.json" }],
			"local/sync",
			[],
			{ skipHashing: true },
		);

		expect(manifest).toEqual(cached);
		expect(addSyncLog).toHaveBeenCalledWith(
			expect.stringContaining("hashes skipped"),
			"info",
		);
	});

	it("bumps versions using the higher of local and remote entries when content changes", async () => {
		storage.readFile.mockResolvedValueOnce(
			JSON.stringify([
				{ path: "/alpha.json", hash: "old-hash", size: 3, version: "8" },
			]),
		);
		storage.readFile.mockResolvedValueOnce("hello");

		const manifest = await updateLocalManifest(
			[{ path: "/alpha.json", fullPath: "/local/sync/alpha.json" }],
			"local/sync",
			[{ path: "/alpha.json", version: "4" }],
		);

		expect(manifest[0].version).toBe("9");
	});
});
