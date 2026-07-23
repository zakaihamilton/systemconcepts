import { writeCompressedFile } from "@sync/bundle";
import { getFileInfo } from "@sync/hash";
import { addSyncLog } from "@sync/logs";
import { updateManifestEntry } from "@sync/manifest";
import { lockMutex } from "@sync/mutex";
import { logger } from "@util/api/logger";
import storage from "@util/storage/storage";
import {
	getListing,
	slimSessionForPersist,
	stringifyJsonArrayChunked,
	updateBundleFile,
	updateYearSync,
} from "./utils";

jest.mock("@sync/bundle", () => ({
	writeCompressedFile: jest.fn(),
}));
jest.mock("@sync/hash", () => ({
	getFileInfo: jest.fn(),
}));
jest.mock("@sync/logs", () => ({
	addSyncLog: jest.fn(),
}));
jest.mock("@sync/manifest", () => ({
	updateManifestEntry: jest.fn(),
}));
jest.mock("@sync/mutex", () => ({
	lockMutex: jest.fn(async () => jest.fn()),
}));
jest.mock("@util/api/logger", () => ({
	logger: {
		debug: jest.fn(),
		error: jest.fn(),
		info: jest.fn(),
		warn: jest.fn(),
	},
}));
jest.mock("@util/storage/storage", () => ({
	exists: jest.fn(),
	getListing: jest.fn(),
	readFile: jest.fn(),
	writeFile: jest.fn(),
	deleteFile: jest.fn(),
	createFolderPath: jest.fn(),
	rename: jest.fn(),
}));
jest.mock("@storage/syncYearFiles", () => ({
	lastYearFileBackend: "opfs",
}));

describe("getListing", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("returns the listing when storage returns items", async () => {
		storage.getListing.mockResolvedValue([{ name: "a" }, { name: "b" }]);
		const result = await getListing("some/path");
		expect(result).toEqual([{ name: "a" }, { name: "b" }]);
	});

	it("returns an empty array and warns when storage returns no listing", async () => {
		storage.getListing.mockResolvedValue(null);
		const result = await getListing("some/path");
		expect(result).toEqual([]);
		expect(logger.warn).toHaveBeenCalledWith(
			expect.stringContaining("No listing returned for"),
		);
	});
});

describe("slimSessionForPersist", () => {
	it("keeps only name/path on media refs and drops summaryText", () => {
		const slim = slimSessionForPersist({
			id: "2024-01-01 Talk",
			summaryText: "huge body",
			audio: {
				name: "a.m4a",
				path: "wasabi/g/a.m4a",
				mtimeMs: 1,
				size: 99,
			},
		});
		expect(slim.summaryText).toBeUndefined();
		expect(slim.audio).toEqual({ name: "a.m4a", path: "wasabi/g/a.m4a" });
	});
});

describe("stringifyJsonArrayChunked", () => {
	it("stringifies arrays and reports progress", async () => {
		const progress = jest.fn();
		const json = await stringifyJsonArrayChunked(
			[{ id: 1 }, { id: 2 }],
			progress,
		);
		expect(JSON.parse(json)).toEqual([{ id: 1 }, { id: 2 }]);
		expect(progress).toHaveBeenCalled();
	});
});

describe("updateYearSync", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		lockMutex.mockImplementation(async () => jest.fn());
		getFileInfo.mockResolvedValue({ hash: "hash1", size: 100 });
		storage.exists.mockResolvedValue(false);
		storage.createFolderPath.mockResolvedValue(undefined);
		storage.writeFile.mockResolvedValue(undefined);
		storage.deleteFile.mockResolvedValue(undefined);
		storage.rename.mockResolvedValue(undefined);
		writeCompressedFile.mockResolvedValue(undefined);
		updateManifestEntry.mockResolvedValue(undefined);
	});

	it("returns zero counters for an empty sessions array", async () => {
		const result = await updateYearSync("test", "2024", []);
		expect(result).toEqual({ counter: 0, newCount: 0, newSessions: [] });
		expect(storage.writeFile).not.toHaveBeenCalled();
	});

	it("writes via temp file then renames without deleting the live file first", async () => {
		const result = await updateYearSync("test", "2024", [
			{ id: "b-session" },
			{ id: "a-session" },
		]);

		expect(storage.writeFile).toHaveBeenCalledWith(
			"/local/sync/test/2024.json.tmp",
			expect.any(String),
		);
		expect(storage.rename).toHaveBeenCalledWith(
			"/local/sync/test/2024.json.tmp",
			"/local/sync/test/2024.json",
		);
		// Must never delete the live year file before the new one is ready.
		expect(storage.deleteFile).not.toHaveBeenCalledWith(
			"/local/sync/test/2024.json",
		);
		const [, jsonString] = storage.writeFile.mock.calls[0];
		const data = JSON.parse(jsonString);
		expect(data.sessions.map((s) => s.name)).toEqual([
			"a-session",
			"b-session",
		]);
		expect(result.newCount).toBe(2);
		expect(addSyncLog).toHaveBeenCalledWith(
			expect.stringContaining("✓ Saved"),
			"success",
		);
	});

	it("leaves the live year file intact when the temp write fails", async () => {
		storage.writeFile.mockRejectedValue(new Error("write failed"));

		const result = await updateYearSync("test", "2024", [{ id: "a-session" }]);

		expect(result).toEqual({ counter: 0, newCount: 0, newSessions: [] });
		expect(storage.deleteFile).not.toHaveBeenCalledWith(
			"/local/sync/test/2024.json",
		);
		expect(storage.rename).not.toHaveBeenCalled();
		expect(addSyncLog).toHaveBeenCalledWith(
			expect.stringContaining("Save failed"),
			"error",
		);
	});

	it("uses previousSessions for new-count", async () => {
		const result = await updateYearSync(
			"test",
			"2024",
			[{ id: "a-session" }, { id: "b-session" }],
			[{ id: "a-session", name: "a-session" }],
		);

		expect(result.newCount).toBe(1);
		expect(result.newSessions.map((s) => s.name)).toEqual(["b-session"]);
	});
});

describe("updateBundleFile", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		lockMutex.mockImplementation(async () => jest.fn());
		getFileInfo.mockResolvedValue({ hash: "hash2", size: 200 });
		writeCompressedFile.mockResolvedValue(undefined);
		updateManifestEntry.mockResolvedValue(undefined);
		storage.exists.mockResolvedValue(false);
	});

	it("creates a new bundle when none exists", async () => {
		await updateBundleFile([{ id: "s1", group: "test" }]);

		expect(writeCompressedFile).toHaveBeenCalledWith(
			"/local/sync/bundle.json",
			expect.any(String),
		);
	});

	it("propagates an error when reading the existing bundle fails", async () => {
		storage.exists.mockResolvedValue(true);
		storage.readFile.mockRejectedValue(new Error("read failed"));

		await expect(
			updateBundleFile([{ id: "s1", group: "test" }]),
		).rejects.toThrow("read failed");
	});
});
