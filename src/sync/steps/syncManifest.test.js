import storage from "@util/storage/storage";
import { readCompressedFile, writeCompressedFile } from "../bundle";
import { addSyncLog } from "../logs";
import { syncManifest } from "./syncManifest";

jest.mock("@util/storage/storage", () => ({
	__esModule: true,
	default: {
		getRecursiveList: jest.fn(),
		readFile: jest.fn(),
	},
}));

jest.mock("../bundle", () => ({
	readCompressedFile: jest.fn(),
	writeCompressedFile: jest.fn(),
}));

jest.mock("../logs", () => ({ addSyncLog: jest.fn() }));

// The function attaches `loadedFromManifest`/`authoritative` flags directly onto
// the returned array, which breaks toEqual's array comparison. Strip them first.
function asPlainArray(manifest) {
	return [...manifest];
}

describe("syncManifest", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		writeCompressedFile.mockResolvedValue(undefined);
	});

	it("loads and normalizes a manifest from files.json.gz", async () => {
		readCompressedFile.mockResolvedValue([
			{ path: "alpha.json", version: "1" },
		]);

		const result = await syncManifest("aws/sync");

		expect(asPlainArray(result)).toEqual([
			{ path: "/alpha.json", version: "1" },
		]);
		expect(result.loadedFromManifest).toBe(true);
		expect(result.authoritative).toBe(true);
		expect(storage.readFile).not.toHaveBeenCalled();
	});

	it("deduplicates entries by keeping the highest version and re-saves the cleaned manifest", async () => {
		readCompressedFile.mockResolvedValue([
			{ path: "/dup.json", version: "1" },
			{ path: "/dup.json", version: "3" },
			{ path: "loadedFromManifest" },
			{ version: "5" },
		]);

		const result = await syncManifest("aws/sync", false);

		expect(asPlainArray(result)).toEqual([{ path: "/dup.json", version: "3" }]);
		expect(writeCompressedFile).toHaveBeenCalledWith(
			"/aws/sync/files.json.gz",
			result,
		);
	});

	it("does not re-save a cleaned manifest while the sync is locked", async () => {
		readCompressedFile.mockResolvedValue([
			{ path: "/dup.json", version: "1" },
			{ path: "/dup.json", version: "3" },
		]);

		await syncManifest("aws/sync", true);

		expect(writeCompressedFile).not.toHaveBeenCalled();
		expect(addSyncLog).toHaveBeenCalledWith(
			expect.stringContaining("Synced manifest"),
			"info",
		);
	});

	it("propagates a transient (non-404) failure reading the compressed manifest", async () => {
		readCompressedFile.mockRejectedValue(new Error("network failed"));

		await expect(syncManifest("aws/sync")).rejects.toThrow("network failed");
	});

	it("throws when the compressed manifest exists but is not an array", async () => {
		readCompressedFile.mockResolvedValue({ not: "an array" });

		await expect(syncManifest("aws/sync")).rejects.toThrow(
			"Invalid remote sync manifest",
		);
	});

	it("falls back to files.json when files.json.gz is missing (404)", async () => {
		readCompressedFile.mockResolvedValue(null);
		storage.readFile.mockResolvedValue(
			JSON.stringify([{ path: "/beta.json", version: "2" }]),
		);

		const result = await syncManifest("aws/sync");

		expect(asPlainArray(result)).toEqual([
			{ path: "/beta.json", version: "2" },
		]);
		expect(result.loadedFromManifest).toBe(true);
		expect(result.authoritative).toBe(true);
	});

	it("throws when files.json content is not a JSON array", async () => {
		readCompressedFile.mockResolvedValue(null);
		storage.readFile.mockResolvedValue(JSON.stringify({ a: 1 }));

		await expect(syncManifest("aws/sync")).rejects.toThrow(
			"Invalid remote sync manifest",
		);
	});

	it("stays empty without scanning remote storage when skipScan is set", async () => {
		readCompressedFile.mockResolvedValue(null);
		storage.readFile.mockResolvedValue(null);

		const result = await syncManifest("aws/sync", false, true);

		expect(asPlainArray(result)).toEqual([]);
		expect(result.loadedFromManifest).toBe(false);
		expect(result.authoritative).toBe(false);
		expect(storage.getRecursiveList).not.toHaveBeenCalled();
	});

	it("generates a manifest from a recursive listing when nothing else is available", async () => {
		readCompressedFile.mockResolvedValue(null);
		storage.readFile.mockResolvedValue(null);
		storage.getRecursiveList.mockResolvedValue([
			{ type: "dir", name: "folder", path: "/aws/sync/folder" },
			{
				type: "file",
				name: "files.json.gz",
				path: "/aws/sync/files.json.gz",
			},
			{ type: "file", name: ".DS_Store", path: "/aws/sync/.DS_Store" },
			{
				type: "file",
				name: "old.json",
				path: "/aws/sync/.sync-trash/run/old.json",
			},
			{
				type: "file",
				name: "gamma.json.gz",
				path: "/aws/sync/gamma.json.gz",
				size: 42,
				mtimeMs: 555,
			},
		]);

		const result = await syncManifest("aws/sync");

		expect(asPlainArray(result)).toEqual([
			{ path: "/gamma.json", size: 42, hash: null, version: "555" },
		]);
		expect(result.authoritative).toBe(true);
		expect(result.loadedFromManifest).toBe(false);
		expect(writeCompressedFile).toHaveBeenCalledWith(
			"/aws/sync/files.json.gz",
			result,
		);
	});

	it("does not persist a generated manifest while locked", async () => {
		readCompressedFile.mockResolvedValue(null);
		storage.readFile.mockResolvedValue(null);
		storage.getRecursiveList.mockResolvedValue([
			{
				type: "file",
				name: "gamma.json.gz",
				path: "/aws/sync/gamma.json.gz",
				size: 1,
				mtimeMs: 10,
			},
		]);

		await syncManifest("aws/sync", true);

		expect(writeCompressedFile).not.toHaveBeenCalled();
		expect(addSyncLog).toHaveBeenCalledWith(
			expect.stringContaining("not saved - locked"),
			"info",
		);
	});

	it("logs critically when every entry is filtered during normalization", async () => {
		const { logger } = require("@util/api/logger");
		jest.spyOn(logger, "error").mockImplementation(() => {});
		readCompressedFile.mockResolvedValue([
			{ path: "loadedFromManifest" },
			{ version: "1" },
		]);

		const result = await syncManifest("aws/sync");
		expect(asPlainArray(result)).toEqual([]);
		expect(logger.error).toHaveBeenCalledWith(
			expect.stringContaining("CRITICAL"),
		);
	});

	it("keeps an existing higher version when a duplicate is lower", async () => {
		readCompressedFile.mockResolvedValue([
			{ path: "/dup.json", version: "5" },
			{ path: "/dup.json", version: "2" },
			{ path: null, version: "1" },
		]);
		const result = await syncManifest("aws/sync", true);
		expect(asPlainArray(result)).toEqual([{ path: "/dup.json", version: "5" }]);
	});
});
