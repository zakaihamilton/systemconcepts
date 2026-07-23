import { writeCompressedFile } from "@sync/bundle";
import { getFileInfo } from "@sync/hash";
import { updateManifestEntry } from "@sync/manifest";
import { lockMutex } from "@sync/mutex";
import { logger } from "@util/api/logger";
import storage from "@util/storage/storage";
import {
	getListing,
	slimSessionForPersist,
	updateBundleFile,
	updateYearSync,
} from "./utils";

jest.mock("@sync/bundle", () => ({
	writeCompressedFile: jest.fn(),
}));
jest.mock("@sync/hash", () => ({
	getFileInfo: jest.fn(),
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
	it("keeps only name/path on media refs", () => {
		const slim = slimSessionForPersist({
			id: "2024-01-01 Talk",
			audio: {
				name: "a.m4a",
				path: "wasabi/g/a.m4a",
				mtimeMs: 1,
				size: 99,
			},
			image: { name: "a.jpg", path: "wasabi/g/a.jpg", mode: 0o644 },
			summary: { name: "a.md", path: "aws/a.md", extra: true },
		});
		expect(slim.audio).toEqual({ name: "a.m4a", path: "wasabi/g/a.m4a" });
		expect(slim.image).toEqual({ name: "a.jpg", path: "wasabi/g/a.jpg" });
		expect(slim.summary).toEqual({ name: "a.md", path: "aws/a.md" });
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
		expect(getFileInfo).toHaveBeenCalledWith(jsonString);
		expect(updateManifestEntry).toHaveBeenCalledWith(
			"/local/sync/files.json",
			expect.objectContaining({ path: "/test/2024.json", hash: "hash1" }),
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
	});

	it("warns but does not fail when updating the manifest after write fails", async () => {
		updateManifestEntry.mockRejectedValueOnce(new Error("manifest failed"));

		const result = await updateYearSync("test", "2024", [{ id: "a-session" }]);

		expect(writeCompressedFile).toHaveBeenCalled();
		expect(result.newCount).toBe(1);
		expect(logger.warn).toHaveBeenCalledWith(
			expect.stringContaining("Failed to update manifest"),
			expect.any(Error),
		);
	});

	it("locks the year file and manifest while persisting", async () => {
		const yearUnlock = jest.fn();
		const manifestUnlock = jest.fn();
		lockMutex
			.mockResolvedValueOnce(yearUnlock)
			.mockResolvedValueOnce(manifestUnlock);

		await updateYearSync("test", "2024", [{ id: "a-session" }]);

		expect(lockMutex).toHaveBeenCalledWith({
			id: "/local/sync/test/2024.json",
		});
		expect(lockMutex).toHaveBeenCalledWith({ id: "/local/sync/files.json" });
		expect(yearUnlock).toHaveBeenCalled();
		expect(manifestUnlock).toHaveBeenCalled();
	});

	it("slims media refs in the persisted payload", async () => {
		await updateYearSync("test", "2024", [
			{
				id: "a-session",
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

	it("warns but does not throw when updating the manifest fails", async () => {
		storage.exists.mockResolvedValue(false);
		updateManifestEntry.mockRejectedValueOnce(new Error("manifest failed"));

		await updateBundleFile([{ id: "s1", group: "test" }]);

		expect(logger.warn).toHaveBeenCalledWith(
			expect.stringContaining("Failed to update manifest"),
			expect.any(Error),
		);
	});
});
