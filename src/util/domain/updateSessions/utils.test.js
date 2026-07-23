import { writeCompressedFile } from "@sync/bundle";
import { getFileInfo } from "@sync/hash";
import { updateManifestEntry } from "@sync/manifest";
import { lockMutex } from "@sync/mutex";
import { logger } from "@util/api/logger";
import storage from "@util/storage/storage";
import { getListing, updateBundleFile, updateYearSync } from "./utils";

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

	it("writes a fresh compact year file when none exists and reports all sessions as new", async () => {
		storage.exists.mockResolvedValue(false);

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
				version: 1,
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
	});

	it("increments the version when a previous file exists", async () => {
		storage.exists.mockResolvedValue(true);
		storage.readFile.mockResolvedValue(
			JSON.stringify({ version: 3, group: "test", sessions: [] }),
		);

		await updateYearSync("test", "2024", [{ id: "a-session" }]);

		const [, jsonString] = writeCompressedFile.mock.calls[0];
		expect(JSON.parse(jsonString).version).toBe(4);
	});

	it("returns unchanged when the serialized sessions match the existing file", async () => {
		const existingSessions = [{ name: "a-session", id: "a-session" }];
		storage.exists.mockResolvedValue(true);
		storage.readFile.mockResolvedValue(
			JSON.stringify({
				version: 1,
				group: "test",
				sessions: existingSessions,
			}),
		);

		const result = await updateYearSync("test", "2024", [{ id: "a-session" }]);

		expect(result).toEqual({ counter: 0, newCount: 0, newSessions: [] });
		expect(writeCompressedFile).not.toHaveBeenCalled();
	});

	it("identifies only the new sessions when existing content differs", async () => {
		storage.exists.mockResolvedValue(true);
		storage.readFile.mockResolvedValue(
			JSON.stringify({
				version: 1,
				group: "test",
				sessions: [{ name: "a-session", id: "a-session" }],
			}),
		);

		const result = await updateYearSync("test", "2024", [
			{ id: "a-session" },
			{ id: "b-session" },
		]);

		expect(result.newCount).toBe(1);
		expect(result.newSessions.map((s) => s.name)).toEqual(["b-session"]);
	});

	it("treats all sessions as new when the existing file fails to parse", async () => {
		storage.exists.mockResolvedValue(true);
		storage.readFile.mockResolvedValue("not json");

		const result = await updateYearSync("test", "2024", [{ id: "a-session" }]);

		expect(result.newCount).toBe(1);
	});

	it("returns zero counters and logs an error when writing fails", async () => {
		storage.exists.mockResolvedValue(false);
		writeCompressedFile.mockRejectedValueOnce(new Error("write failed"));

		const result = await updateYearSync("test", "2024", [{ id: "a-session" }]);

		expect(result).toEqual({ counter: 0, newCount: 0, newSessions: [] });
		expect(logger.error).toHaveBeenCalledWith(
			expect.stringContaining("Error updating year sync"),
			expect.any(Error),
		);
	});

	it("warns but does not fail when updating the manifest after write fails", async () => {
		storage.exists.mockResolvedValue(false);
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
		storage.exists.mockResolvedValue(false);
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

	it("starts at version 1 when the existing file cannot be parsed for versioning", async () => {
		storage.exists.mockResolvedValue(true);
		storage.readFile.mockResolvedValue("not json");

		await updateYearSync("test", "2024", [{ id: "a-session" }]);

		const [, jsonString] = writeCompressedFile.mock.calls[0];
		expect(JSON.parse(jsonString).version).toBe(1);
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
