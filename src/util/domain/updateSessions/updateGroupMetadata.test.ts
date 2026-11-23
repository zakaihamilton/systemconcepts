import "./updateGroupTestSetup";
import { logger } from "@util/api/logger";
import storage from "@util/storage/storage";
import {
	loadDurations,
	loadSummaries,
	loadTags,
	loadTranscriptions,
} from "./metadata";
import { fetchSessionMetadata } from "./sessionMetadataClient";
import { updateGroupProcess } from "./updateGroup";
import {
	cachedYearSession,
	expectSessionField,
	file,
	mockListingResponses,
	mockStaleLocalYearCache,
	mockYearListing,
	sessionMetadataFiles,
	setupUpdateGroupTest,
	yearMetadata,
} from "./updateGroupTestSetup";
import { updateYearSync } from "./utils";

async function updateFromStaleLocalYearCache(
	year: string,
	sessionKey: string,
	sessions: Parameters<typeof mockStaleLocalYearCache>[2],
) {
	mockStaleLocalYearCache(year, sessionKey, sessions);
	await updateGroupProcess("test", false, false);
	expect(fetchSessionMetadata).not.toHaveBeenCalled();
	const [, , updatedSessions] = asMock(updateYearSync).mock.calls[0];
	return updatedSessions;
}

describe("updateGroupProcess metadata resolution", () => {
	beforeEach(() => {
		setupUpdateGroupTest();
	});

	it("falls back to legacy metadata loaders when aggregated metadata fails", async () => {
		asMock(fetchSessionMetadata).mockRejectedValueOnce(
			new Error("backend busy"),
		);
		asMock(loadTags).mockResolvedValue({
			"2024-05-05 Test Session": ["legacy"],
		});
		asMock(loadDurations).mockResolvedValue({ "2024-05-05 Test Session": 456 });
		asMock(loadSummaries).mockResolvedValue({
			"2024-05-05 Test Session": "Legacy summary",
		});
		asMock(loadTranscriptions).mockResolvedValue({
			"2024-05-05 Test Session": true,
		});

		await updateGroupProcess("test", true);

		expect(loadTags).toHaveBeenCalledTimes(1);
		expect(loadDurations).toHaveBeenCalledTimes(1);
		expect(loadSummaries).toHaveBeenCalledTimes(1);
		expect(loadTranscriptions).toHaveBeenCalledTimes(1);
		expect(logger.warn).toHaveBeenCalledWith(
			expect.stringContaining("Aggregated metadata fetch failed"),
			expect.any(Error),
		);
		const [, , sessions] = asMock(updateYearSync).mock.calls[0];
		expect(sessions[0].tags).toEqual(["legacy"]);
		expect(sessions[0].duration).toBe(456);
		expect(sessions[0].summaryText).toBe("Legacy summary");
		expect(sessions[0].transcription).toBe(true);
	});

	it("skips legacy metadata fallback after a metadata timeout", async () => {
		asMock(fetchSessionMetadata).mockRejectedValueOnce(
			new Error("Timed out loading session metadata for test/2024"),
		);

		await updateGroupProcess("test", true);

		expect(loadTags).not.toHaveBeenCalled();
		expect(loadDurations).not.toHaveBeenCalled();
		expect(logger.warn).toHaveBeenCalledWith(
			expect.stringContaining("skipping legacy fallback after timeout"),
			expect.any(Error),
		);
		expect(updateYearSync).toHaveBeenCalled();
	});

	it("falls back to per-file tags/duration/summary when zip metadata is empty", async () => {
		asMock(fetchSessionMetadata).mockResolvedValue(
			yearMetadata({
				items: sessionMetadataFiles("2024", "2024-05-05 Test Session", [
					"tags",
					"duration",
					"md",
					"txt",
				]),
			}),
		);
		asMock(storage.readFile).mockImplementation(async (path: any) => {
			if (path.endsWith(".tags"))
				return JSON.stringify({ tags: ["from-file"] });
			if (path.endsWith(".duration")) return JSON.stringify({ duration: 55 });
			if (path.endsWith(".md")) return "Summary body";
			return "";
		});

		await updateGroupProcess("test", true, true);

		expect(updateYearSync).toHaveBeenCalled();
		const [, , sessions] = asMock(updateYearSync).mock.calls[0];
		expect(sessions[0].tags).toEqual(["from-file"]);
		expect(sessions[0].duration).toBe(55);
		expect(sessions[0].summaryText || sessions[0].summary).toBeTruthy();
		expect(sessions[0].transcription).toBe(true);
	});

	it("warns when per-file metadata reads fail", async () => {
		asMock(fetchSessionMetadata).mockResolvedValue(
			yearMetadata({
				items: sessionMetadataFiles("2024", "2024-05-05 Test Session", [
					"tags",
					"duration",
					"md",
				]),
			}),
		);
		asMock(storage.readFile).mockRejectedValue(new Error("meta read fail"));

		await updateGroupProcess("test", true, true);

		expect(logger.warn).toHaveBeenCalledWith(
			expect.stringContaining("Failed to read tags file"),
			expect.any(Error),
		);
		expect(logger.warn).toHaveBeenCalledWith(
			expect.stringContaining("Failed to read duration file"),
			expect.any(Error),
		);
		expect(logger.warn).toHaveBeenCalledWith(
			expect.stringContaining("Failed to read summary file"),
			expect.any(Error),
		);
	});

	it("strips resolution suffixes from video session ids", async () => {
		mockYearListing("2024", [
			file(
				"2024-05-05 Test Session_1920x1080.mp4",
				"wasabi/test/2024/2024-05-05 Test Session_1920x1080.mp4",
			),
		]);
		asMock(fetchSessionMetadata).mockResolvedValue(
			yearMetadata({
				tags: { "2024-05-05 Test Session": ["hd"] },
			}),
		);

		await updateGroupProcess("test", true, false);

		const [, , sessions] = asMock(updateYearSync).mock.calls[0];
		expectSessionField(sessions[0], "id", "2024-05-05 Test Session");
		expectSessionField(sessions[0], "tags", ["hd"]);
	});

	it("matches metadata keys with normalized punctuation and casing", async () => {
		mockYearListing("2024", [
			file(
				"2024-05-05 Test Session.mp4",
				"wasabi/test/2024/2024-05-05 Test Session.mp4",
			),
		]);
		asMock(fetchSessionMetadata).mockResolvedValue(
			yearMetadata({
				tags: { "20240505testsession": ["normalized"] },
				durations: { "2024-05-05 test session": 88 },
			}),
		);

		await updateGroupProcess("test", true, false);

		const [, , sessions] = asMock(updateYearSync).mock.calls[0];
		expect(sessions[0].tags).toEqual(["normalized"]);
		expect(sessions[0].duration).toBe(88);
	});

	it("ignores year-level metadata files when grouping session files", async () => {
		mockYearListing("2024", [
			file("2024.tags", "wasabi/test/2024/2024.tags"),
			file("2024.duration", "wasabi/test/2024/2024.duration"),
			file(
				"2024-05-05 Test Session.mp4",
				"wasabi/test/2024/2024-05-05 Test Session.mp4",
			),
		]);
		asMock(fetchSessionMetadata).mockResolvedValue(yearMetadata());

		await updateGroupProcess("test", true, false);

		const [, , sessions] = asMock(updateYearSync).mock.calls[0];
		expect(sessions).toHaveLength(1);
		expect(sessions[0].id).toBe("2024-05-05 Test Session");
	});

	it("warns when group metadata listing fails but continues processing", async () => {
		mockListingResponses({
			"/aws/sessions/test": new Error("metadata listing down"),
			"wasabi/test": [{ name: "2024", type: "dir", path: "wasabi/test/2024" }],
			"wasabi/test/2024": [
				file(
					"2024-05-05 Test Session.mp4",
					"wasabi/test/2024/2024-05-05 Test Session.mp4",
				),
			],
		});

		await updateGroupProcess("test", true, false);

		expect(logger.warn).toHaveBeenCalledWith(
			expect.stringContaining("Failed to list metadata for test"),
			expect.any(Error),
		);
		expect(updateYearSync).toHaveBeenCalled();
	});

	it("warns when legacy metadata folder listing fails", async () => {
		asMock(fetchSessionMetadata).mockRejectedValue(new Error("backend busy"));
		mockListingResponses({
			"wasabi/test": [{ name: "2024", type: "dir", path: "wasabi/test/2024" }],
			"wasabi/test/2024": [
				file(
					"2024-05-05 Test Session.mp4",
					"wasabi/test/2024/2024-05-05 Test Session.mp4",
				),
			],
			"/aws/sessions/test/2024": new Error("metadata year listing fail"),
		});
		asMock(loadTags).mockResolvedValue({});

		await updateGroupProcess("test", true, false);

		expect(logger.warn).toHaveBeenCalledWith(
			expect.stringContaining("Failed to list metadata folder"),
			expect.any(Error),
		);
	});

	it("reads tags files that contain a raw JSON array", async () => {
		asMock(fetchSessionMetadata).mockResolvedValue(
			yearMetadata({
				items: sessionMetadataFiles("2024", "2024-05-05 Test Session", [
					"tags",
				]),
			}),
		);
		asMock(storage.readFile).mockImplementation(async (path: any) => {
			if (path.endsWith(".tags")) return JSON.stringify(["raw-array-tag"]);
			return "";
		});

		await updateGroupProcess("test", true, true);

		const [, , sessions] = asMock(updateYearSync).mock.calls[0];
		expect(sessions[0].tags).toEqual(["raw-array-tag"]);
	});

	it("loads metadata from local year files when year cache has no metadata payload", async () => {
		const currentYear = String(new Date().getFullYear());
		const sessionId = `${currentYear}-08-01 Cached Metadata Session`;
		const sessions = await updateFromStaleLocalYearCache(
			currentYear,
			sessionId,
			[
				cachedYearSession(sessionId, currentYear, {
					tags: ["local-meta"],
					duration: 444,
					summaryText: "From local year file",
					transcription: true,
				}),
			],
		);
		expect(sessions[0].tags).toEqual(["local-meta"]);
		expect(sessions[0].duration).toBe(444);
		expect(sessions[0].summaryText).toBe("From local year file");
		expect(sessions[0].transcription).toBe(true);
	});

	it("loads cached metadata using name-only session keys from local year files", async () => {
		const currentYear = String(new Date().getFullYear());
		const sessionName = `${currentYear}-09-01 Name Metadata Session`;
		const sessions = await updateFromStaleLocalYearCache(
			currentYear,
			sessionName,
			[
				{
					name: sessionName,
					group: "test",
					year: currentYear,
					tags: ["name-key"],
					duration: 12,
				},
			],
		);
		expect(sessions[0].tags).toEqual(["name-key"]);
		expect(sessions[0].duration).toBe(12);
	});
});