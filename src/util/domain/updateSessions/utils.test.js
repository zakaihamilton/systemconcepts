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
			image: { name: "a.jpg", path: "wasabi/g/a.jpg", mode: 0o644 },
			summary: { name: "a.md", path: "aws/a.md", extra: true },
		});
		expect(slim.summaryText).toBeUndefined();
		expect(slim.audio).toEqual({ name: "a.m4a", path: "wasabi/g/a.m4a" });
		expect(slim.image).toEqual({ name: "a.jpg", path: "wasabi/g/a.jpg" });
		expect(slim.summary).toEqual({ name: "a.md", path: "aws/a.md" });
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
		writeCompressedFile.mockResolvedValue(undefined);
		updateManifestEntry.mockResolvedValue(undefined);
	});

	it("returns zero counters for an empty sessions array", async () => {
		const result = await updateYearSync("test", "2024", []);
		expect(result).toEqual({ counter: 0, newCount: 0, newSessions: [] });
		expect(writeCompressedFile).not.toHaveBeenCalled();
	});

	it("writes a fresh compact year file and reports all sessions as new", async () => {
		const sessions = [{ id: "b-session" }, { id: "a-session" }];
		const result = await updateYearSync("test", "2024", sessions);

		expect(writeCompressedFile).toHaveBeenCalledWith(
			"/local/sync/test/2024.json",
			expect.any(String),
		);
		const [, jsonString] = writeCompressedFile.mock.calls[0];
		expect(jsonString.includes("\n")).toBe(false);
		const data = JSON.parse(jsonString);
		expect(data).toEqual(
			expect.objectContaining({
				group: "test",
				year: "2024",
			}),
		);
		expect(data.sessions.map((s) => s.name)).toEqual([
			"a-session",
			"b-session",
		]);
		expect(result.newCount).toBe(2);
		expect(result.newSessions).toHaveLength(2);
		expect(addSyncLog).toHaveBeenCalledWith(
			expect.stringContaining("Saving 2 session(s)"),
			"info",
		);
		expect(addSyncLog).toHaveBeenCalledWith(
			expect.stringContaining("✓ Saved"),
			"success",
		);
		expect(storage.readFile).not.toHaveBeenCalled();
		expect(storage.exists).not.toHaveBeenCalled();
	});

	it("uses previousSessions for new-count without re-reading disk", async () => {
		const result = await updateYearSync(
			"test",
			"2024",
			[{ id: "a-session" }, { id: "b-session" }],
			[{ id: "a-session", name: "a-session" }],
		);

		expect(result.newCount).toBe(1);
		expect(result.newSessions.map((s) => s.name)).toEqual(["b-session"]);
		expect(storage.readFile).not.toHaveBeenCalled();
		expect(writeCompressedFile).toHaveBeenCalled();
	});

	it("returns zero counters and logs an error when writing fails", async () => {
		writeCompressedFile.mockRejectedValueOnce(new Error("write failed"));

		const result = await updateYearSync("test", "2024", [{ id: "a-session" }]);

		expect(result).toEqual({ counter: 0, newCount: 0, newSessions: [] });
		expect(logger.error).toHaveBeenCalledWith(
			expect.stringContaining("Error updating year sync"),
			expect.any(Error),
		);
		expect(addSyncLog).toHaveBeenCalledWith(
			expect.stringContaining("Save failed"),
			"error",
		);
	});

	it("locks the year file while persisting", async () => {
		const yearUnlock = jest.fn();
		lockMutex.mockResolvedValueOnce(yearUnlock);

		await updateYearSync("test", "2024", [{ id: "a-session" }]);

		expect(lockMutex).toHaveBeenCalledWith({
			id: "/local/sync/test/2024.json",
		});
		expect(yearUnlock).toHaveBeenCalled();
	});

	it("slims media refs and omits summaryText in the persisted payload", async () => {
		await updateYearSync("test", "2024", [
			{
				id: "a-session",
				summaryText: "should not persist",
				audio: {
					name: "a.m4a",
					path: "wasabi/a.m4a",
					mtimeMs: 123,
					size: 456,
				},
			},
		]);

		const [, jsonString] = writeCompressedFile.mock.calls[0];
		const data = JSON.parse(jsonString);
		expect(data.sessions[0].summaryText).toBeUndefined();
		expect(data.sessions[0].audio).toEqual({
			name: "a.m4a",
			path: "wasabi/a.m4a",
		});
	});
});

describe("updateBundleFile", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		lockMutex.mockImplementation(async () => jest.fn());
		getFileInfo.mockResolvedValue({ hash: "hash2", size: 200 });
		writeCompressedFile.mockResolvedValue(undefined);
		updateManifestEntry.mockResolvedValue(undefined);
	});

	it("creates a new bundle when none exists", async () => {
		storage.exists.mockResolvedValue(false);

		await updateBundleFile([{ id: "s1", group: "test" }]);

		expect(writeCompressedFile).toHaveBeenCalledWith(
			"/local/sync/bundle.json",
			expect.any(String),
		);
		const [, jsonString] = writeCompressedFile.mock.calls[0];
		expect(JSON.parse(jsonString)).toEqual(
			expect.objectContaining({
				version: 1,
				sessions: [{ id: "s1", group: "test" }],
			}),
		);
	});

	it("replaces sessions for updated groups while preserving other groups", async () => {
		storage.exists.mockImplementation(
			async (path) => path === "/local/sync/bundle.json",
		);
		storage.readFile.mockResolvedValue(
			JSON.stringify({
				sessions: [
					{ id: "old1", group: "test" },
					{ id: "other1", group: "other" },
				],
			}),
		);

		await updateBundleFile([{ id: "new1", group: "test" }]);

		const [, jsonString] = writeCompressedFile.mock.calls[0];
		const data = JSON.parse(jsonString);
		expect(data.sessions).toEqual(
			expect.arrayContaining([
				{ id: "other1", group: "other" },
				{ id: "new1", group: "test" },
			]),
		);
		expect(data.sessions).toHaveLength(2);
	});

	it("propagates an error when reading the existing bundle fails", async () => {
		storage.exists.mockResolvedValue(true);
		storage.readFile.mockRejectedValue(new Error("read failed"));

		await expect(
			updateBundleFile([{ id: "s1", group: "test" }]),
		).rejects.toThrow("read failed");
		expect(logger.error).toHaveBeenCalledWith(
			expect.stringContaining("Failed to read existing bundle"),
			expect.any(Error),
		);
	});
});
