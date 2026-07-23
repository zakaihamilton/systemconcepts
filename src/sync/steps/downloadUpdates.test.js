import storage from "@util/storage/storage";
import { TextEncoder } from "util";
import { readCompressedFileRaw } from "../bundle";
import { addSyncLog } from "../logs";
import { SyncActiveStore } from "../syncState";
import { moveFolderToTrash } from "../trash";
import {
	beginFreshLocalWriteGeneration,
	downloadUpdates,
} from "./downloadUpdates";

beforeAll(() => {
	global.TextEncoder = TextEncoder;
});

jest.mock("@util/storage/storage", () => ({
	__esModule: true,
	default: {
		readFile: jest.fn(),
		writeFile: jest.fn(),
		createFolderPath: jest.fn(),
		exists: jest.fn(),
	},
}));

jest.mock("../bundle", () => ({
	readCompressedFileRaw: jest.fn(),
}));

jest.mock("../logs", () => ({ addSyncLog: jest.fn() }));

jest.mock("../trash", () => ({
	createSyncTrashId: jest.fn().mockReturnValue("sync-trash-1"),
	moveFolderToTrash: jest.fn(),
}));

jest.mock("@util/data/binary", () => ({
	stringToBinary: jest.fn(() => ({
		arrayBuffer: async () => new ArrayBuffer(8),
	})),
}));

describe("downloadUpdates", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		storage.exists.mockResolvedValue(false);
		storage.writeFile.mockResolvedValue(undefined);
		storage.createFolderPath.mockResolvedValue(undefined);
		SyncActiveStore.update((state) => {
			state.stopping = false;
		});
	});

	it("downloads a new file, writes it locally and updates the local manifest", async () => {
		readCompressedFileRaw.mockResolvedValue('{"a":1}');

		const result = await downloadUpdates(
			[],
			[{ path: "/alpha.json", version: "1", hash: null }],
			"local/sync",
			"aws/sync",
		);

		expect(storage.writeFile).toHaveBeenCalledWith(
			"/local/sync/alpha.json",
			expect.any(String),
		);
		expect(storage.writeFile).toHaveBeenCalledWith(
			"/local/sync/files.json",
			expect.any(String),
		);
		expect(result.hasChanges).toBe(true);
		expect(result.complete).toBe(true);
		expect(result.counts).toEqual({ attempted: 1, succeeded: 1, failed: 0 });
		expect(result.manifest[0].path).toBe("/alpha.json");
	});

	it("completes a mixed groups and split-year download batch", async () => {
		readCompressedFileRaw.mockResolvedValue('{"sessions":[]}');
		const remoteManifest = [
			{ path: "/groups.json", version: "1" },
			...Array.from({ length: 6 }, (_, index) => ({
				path: `/group-${index}/2026.json`,
				version: "1",
			})),
		];

		const result = await downloadUpdates(
			[],
			remoteManifest,
			"local/sync",
			"aws/sync",
		);

		expect(result).toEqual(
			expect.objectContaining({
				hasChanges: true,
				complete: true,
				counts: { attempted: 7, succeeded: 7, failed: 0 },
			}),
		);
		expect(storage.createFolderPath).toHaveBeenCalledTimes(7);
		expect(storage.writeFile).toHaveBeenCalledWith(
			"/local/sync/files.json",
			expect.any(String),
		);
	});

	it("serializes local writes while downloads are processed in parallel", async () => {
		readCompressedFileRaw.mockResolvedValue('{"sessions":[]}');
		let releaseFirstWrite;
		const firstWrite = new Promise((resolve) => {
			releaseFirstWrite = resolve;
		});
		storage.writeFile.mockImplementationOnce(() => firstWrite);

		const sync = downloadUpdates(
			[],
			[
				{ path: "/american/2025.json", version: "1" },
				{ path: "/american/2026.json", version: "1" },
			],
			"local/sync",
			"aws/sync",
		);
		await new Promise((resolve) => setTimeout(resolve, 0));

		expect(storage.writeFile).toHaveBeenCalledTimes(1);
		releaseFirstWrite();
		await sync;

		expect(storage.writeFile).toHaveBeenCalledTimes(3);
	});

	it("does not wait for a previous database generation's stuck write", async () => {
		readCompressedFileRaw.mockResolvedValue('{"sessions":[]}');
		storage.writeFile.mockImplementationOnce(() => new Promise(() => {}));

		void downloadUpdates(
			[],
			[{ path: "/old.json", version: "1" }],
			"local/sync",
			"aws/sync",
		);
		await new Promise((resolve) => setTimeout(resolve, 0));

		beginFreshLocalWriteGeneration();
		const freshSync = await downloadUpdates(
			[],
			[{ path: "/fresh.json", version: "1" }],
			"local/sync",
			"aws/sync",
		);

		expect(freshSync.complete).toBe(true);
		expect(storage.writeFile).toHaveBeenCalledWith(
			"/local/sync/fresh.json",
			expect.any(String),
		);
	});

	it("treats a confirmed 404 as missing and cleans it out of the remote manifest", async () => {
		readCompressedFileRaw.mockResolvedValue(null);

		const remoteManifest = [{ path: "/gone.json", version: "2" }];
		const result = await downloadUpdates(
			[],
			remoteManifest,
			"local/sync",
			"aws/sync",
		);

		expect(result.cleanedRemoteManifest).toEqual([]);
		expect(result.complete).toBe(false);
		expect(result.counts.failed).toBe(1);
		expect(addSyncLog).toHaveBeenCalledWith(
			expect.stringContaining("Removed from remote manifest"),
			"info",
		);
	});

	it("updates only the version when the local hash already matches remote (no download)", async () => {
		const localManifest = [{ path: "/same.json", version: "1", hash: "abc" }];
		const remoteManifest = [{ path: "/same.json", version: "2", hash: "abc" }];

		const result = await downloadUpdates(
			localManifest,
			remoteManifest,
			"local/sync",
			"aws/sync",
		);

		expect(readCompressedFileRaw).not.toHaveBeenCalled();
		expect(result.manifest[0].version).toBe("2");
		expect(storage.writeFile).toHaveBeenCalledWith(
			"/local/sync/files.json",
			expect.any(String),
		);
	});

	it("returns early without writing when there is nothing to download or update", async () => {
		const localManifest = [{ path: "/steady.json", version: "3" }];
		const remoteManifest = [{ path: "/steady.json", version: "3" }];

		const result = await downloadUpdates(
			localManifest,
			remoteManifest,
			"local/sync",
			"aws/sync",
		);

		expect(result).toEqual({
			manifest: localManifest,
			hasChanges: false,
			complete: true,
			counts: { attempted: 0, succeeded: 0, failed: 0 },
			cleanedRemoteManifest: remoteManifest,
		});
		expect(storage.writeFile).not.toHaveBeenCalled();
	});

	it("force-restores a locally deleted file when restoreMissingFiles is set", async () => {
		readCompressedFileRaw.mockResolvedValue('{"restored":true}');
		const localManifest = [
			{ path: "/deleted.json", version: "5", deleted: true },
		];
		const remoteManifest = [{ path: "/deleted.json", version: "3" }];

		const result = await downloadUpdates(
			localManifest,
			remoteManifest,
			"local/sync",
			"aws/sync",
			true,
			null,
			true,
		);

		expect(addSyncLog).toHaveBeenCalledWith(
			expect.stringContaining("Safety Restore"),
			"warning",
		);
		expect(result.hasChanges).toBe(true);
	});

	it("keeps admin-side deletions and skips re-download when uploads are allowed", async () => {
		const localManifest = [
			{ path: "/deleted.json", version: "5", deleted: true },
		];
		const remoteManifest = [{ path: "/deleted.json", version: "3" }];

		const result = await downloadUpdates(
			localManifest,
			remoteManifest,
			"local/sync",
			"aws/sync",
			true,
			null,
			false,
		);

		expect(readCompressedFileRaw).not.toHaveBeenCalled();
		expect(result.hasChanges).toBe(false);
		expect(result.manifest).toEqual(localManifest);
	});

	it("restores a locally deleted file for read-only roles (student/visitor)", async () => {
		readCompressedFileRaw.mockResolvedValue('{"restored":true}');
		const localManifest = [
			{ path: "/deleted.json", version: "5", deleted: true },
		];
		const remoteManifest = [{ path: "/deleted.json", version: "3" }];

		const result = await downloadUpdates(
			localManifest,
			remoteManifest,
			"local/sync",
			"aws/sync",
			false,
		);

		expect(readCompressedFileRaw).toHaveBeenCalled();
		expect(result.hasChanges).toBe(true);
	});

	it("detects a local edit conflict and bumps the version instead of overwriting", async () => {
		readCompressedFileRaw.mockResolvedValue("remote content");
		storage.exists.mockResolvedValue(true);
		storage.readFile.mockResolvedValue("local edited content");

		const localManifest = [
			{ path: "/conflict.json", version: "1", hash: "local-hash-value" },
		];
		const remoteManifest = [
			{ path: "/conflict.json", version: "2", hash: "remote-hash-value" },
		];

		const result = await downloadUpdates(
			localManifest,
			remoteManifest,
			"local/sync",
			"aws/sync",
		);

		// Because the local file's hash differs from the manifest entry, we must
		// treat this as a conflict and avoid clobbering the local edit.
		expect(
			storage.writeFile.mock.calls.some(
				(call) => call[0] === "/local/sync/conflict.json",
			),
		).toBe(false);
		expect(result.manifest[0].version).toBe("3");
	});

	it("moves a directory to trash and retries the write when EISDIR is thrown", async () => {
		readCompressedFileRaw.mockResolvedValue('{"a":1}');
		storage.writeFile
			.mockRejectedValueOnce(
				new Error("EISDIR: illegal operation on a directory"),
			)
			.mockResolvedValueOnce(undefined)
			.mockResolvedValueOnce(undefined);
		moveFolderToTrash.mockResolvedValue({ moved: true });

		await downloadUpdates(
			[],
			[{ path: "/adir/file.json", version: "1" }],
			"local/sync",
			"aws/sync",
		);

		expect(moveFolderToTrash).toHaveBeenCalledWith(
			"local/sync",
			"sync-trash-1",
			"/adir/file.json",
		);
	});

	it("marks a download as failed when a non-404 error occurs, without throwing", async () => {
		readCompressedFileRaw.mockRejectedValue(new Error("network failed"));

		const result = await downloadUpdates(
			[],
			[{ path: "/broken.json", version: "1" }],
			"local/sync",
			"aws/sync",
		);

		expect(result.counts.failed).toBe(1);
		expect(result.complete).toBe(false);
		expect(addSyncLog).toHaveBeenCalledWith(
			"Failed to download: /broken.json",
			"error",
		);
	});

	it("stops processing further batches once a stop is requested", async () => {
		readCompressedFileRaw.mockResolvedValue('{"a":1}');
		const remoteManifest = Array.from({ length: 12 }, (_, i) => ({
			path: `/file-${i}.json`,
			version: "1",
		}));

		let callCount = 0;
		storage.writeFile.mockImplementation(async (path) => {
			callCount++;
			if (callCount === 1 && path.startsWith("/local/sync/file-")) {
				SyncActiveStore.update((state) => {
					state.stopping = true;
				});
			}
		});

		const result = await downloadUpdates(
			[],
			remoteManifest,
			"local/sync",
			"aws/sync",
		);

		expect(addSyncLog).toHaveBeenCalledWith(
			"Download stopped by user",
			"warning",
		);
		expect(result.complete).toBe(false);
	});

	it("reports progress via an injected progress tracker", async () => {
		readCompressedFileRaw.mockResolvedValue('{"a":1}');
		const progressTracker = { updateProgress: jest.fn() };

		await downloadUpdates(
			[],
			[{ path: "/alpha.json", version: "1" }],
			"local/sync",
			"aws/sync",
			true,
			progressTracker,
		);

		expect(progressTracker.updateProgress).toHaveBeenCalledWith(
			"downloadUpdates",
			expect.objectContaining({ total: 1 }),
		);
	});

	it("propagates unexpected top-level errors", async () => {
		readCompressedFileRaw.mockResolvedValue('{"a":1}');
		storage.writeFile.mockRejectedValue(new Error("disk full"));

		await expect(
			downloadUpdates(
				[],
				[{ path: "/alpha.json", version: "1" }],
				"local/sync",
				"aws/sync",
			),
		).rejects.toThrow("disk full");
		expect(addSyncLog).toHaveBeenCalledWith(
			expect.stringContaining("Download failed"),
			"error",
		);
	});

	it("downloads binary files directly without JSON decompression", async () => {
		storage.readFile.mockResolvedValue("YmluYXJ5ZGF0YQ==");

		const result = await downloadUpdates(
			[],
			[{ path: "/photo.png", version: "1" }],
			"local/sync",
			"aws/sync",
		);

		expect(storage.readFile).toHaveBeenCalledWith("/aws/sync/photo.png");
		expect(storage.writeFile).toHaveBeenCalledWith(
			"/local/sync/photo.png",
			expect.anything(),
		);
		expect(result.hasChanges).toBe(true);
	});

	it("falls back to legacy .gz binary downloads when the raw file is missing", async () => {
		storage.readFile.mockResolvedValue(null);
		readCompressedFileRaw.mockResolvedValue("legacy-binary");

		const result = await downloadUpdates(
			[],
			[{ path: "/legacy.png", version: "1" }],
			"local/sync",
			"aws/sync",
		);

		expect(readCompressedFileRaw).toHaveBeenCalledWith(
			"/aws/sync/legacy.png.gz",
			expect.objectContaining({ strict: true }),
		);
		expect(result.hasChanges).toBe(true);
	});

	it("retries non-binary downloads without the .gz suffix", async () => {
		readCompressedFileRaw
			.mockResolvedValueOnce(null)
			.mockResolvedValueOnce('{"fallback":true}');

		const result = await downloadUpdates(
			[],
			[{ path: "/plain.json", version: "1" }],
			"local/sync",
			"aws/sync",
		);

		expect(readCompressedFileRaw).toHaveBeenCalledWith(
			"/aws/sync/plain.json",
			expect.objectContaining({ strict: true }),
		);
		expect(result.hasChanges).toBe(true);
	});

	it("writes ArrayBuffer binary content without re-encoding", async () => {
		storage.readFile.mockResolvedValue(new Uint8Array([1, 2, 3]));

		await downloadUpdates(
			[],
			[{ path: "/buf.png", version: "1" }],
			"local/sync",
			"aws/sync",
		);

		expect(storage.writeFile).toHaveBeenCalledWith(
			"/local/sync/buf.png",
			expect.any(Uint8Array),
		);
	});

	it("writes raw content when remote hash matches the uncompressed payload", async () => {
		const payload = '{"keep":"raw"}';
		readCompressedFileRaw.mockResolvedValue(payload);
		const { getFileInfo } = require("../hash");
		const info = await getFileInfo(payload);

		const result = await downloadUpdates(
			[],
			[{ path: "/hashed.json", version: "1", hash: info.hash }],
			"local/sync",
			"aws/sync",
		);

		expect(result.hasChanges).toBe(true);
		expect(storage.writeFile).toHaveBeenCalledWith(
			"/local/sync/hashed.json",
			payload,
		);
	});

	it("pretty-prints small json when no remote hash is provided", async () => {
		readCompressedFileRaw.mockResolvedValue('{"a":1}');

		await downloadUpdates(
			[],
			[{ path: "/pretty.json", version: "1" }],
			"local/sync",
			"aws/sync",
		);

		const contentWrite = storage.writeFile.mock.calls.find(
			(call) => call[0] === "/local/sync/pretty.json",
		)?.[1];
		expect(contentWrite).toContain("\n");
	});

	it("skips pretty-printing for very large json payloads", async () => {
		const large = JSON.stringify({ data: "x".repeat(600 * 1024) });
		readCompressedFileRaw.mockResolvedValue(large);

		await downloadUpdates(
			[],
			[{ path: "/large.json", version: "1" }],
			"local/sync",
			"aws/sync",
		);

		expect(storage.writeFile).toHaveBeenCalledWith(
			"/local/sync/large.json",
			large,
		);
	});

	it("downloads when local manifest is null and skips deleted remote entries", async () => {
		readCompressedFileRaw.mockResolvedValue('{"ok":true}');

		const result = await downloadUpdates(
			null,
			[
				{ path: "/live.json", version: "1", deleted: false },
				{ path: "/gone.json", version: "1", deleted: true },
			],
			"local/sync",
			"aws/sync",
		);

		expect(result.manifest).toHaveLength(1);
		expect(result.manifest[0].path).toBe("/live.json");
	});

	it("downloads a newer remote file when local entry is missing", async () => {
		readCompressedFileRaw.mockResolvedValue('{"fresh":true}');

		const result = await downloadUpdates(
			[],
			[{ path: "/new.json", version: "2" }],
			"local/sync",
			"aws/sync",
		);

		expect(result.hasChanges).toBe(true);
		expect(result.manifest[0].path).toBe("/new.json");
	});

	it("writes local file when manifest entry exists and on-disk hash still matches", async () => {
		const payload = '{"same":true}';
		readCompressedFileRaw.mockResolvedValue(payload);
		storage.exists.mockResolvedValue(true);
		storage.readFile.mockResolvedValue(payload);
		const { getFileInfo } = require("../hash");
		const info = await getFileInfo(payload);

		const result = await downloadUpdates(
			[{ path: "/same.json", version: "1", hash: info.hash }],
			[{ path: "/same.json", version: "2", hash: "remote-hash" }],
			"local/sync",
			"aws/sync",
		);

		expect(
			storage.writeFile.mock.calls.some(
				(call) => call[0] === "/local/sync/same.json",
			),
		).toBe(true);
		expect(result.hasChanges).toBe(true);
	});

	it("rethrows non-EISDIR write failures", async () => {
		readCompressedFileRaw.mockResolvedValue('{"a":1}');
		storage.writeFile.mockRejectedValue(new Error("ENOSPC: no space"));

		await expect(
			downloadUpdates(
				[],
				[{ path: "/alpha.json", version: "1" }],
				"local/sync",
				"aws/sync",
			),
		).rejects.toThrow("ENOSPC");
	});
});
