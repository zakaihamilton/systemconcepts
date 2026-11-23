import "./updateGroupTestSetup";
import { writeCompressedFile } from "@sync/bundle";
import { getFileInfo } from "@sync/hash";
import { updateManifestEntry } from "@sync/manifest";
import { addSyncLog } from "@sync/sync";
import { logger } from "@util/api/logger";
import storage from "@util/storage/storage";
import { getCombinedYearFingerprint } from "./fingerprints";
import { fetchSessionMetadata } from "./sessionMetadataClient";
import { updateGroupProcess } from "./updateGroup";
import {
	emptyYearMetadata,
	file,
	groupUpdateStatus,
	mockListingResponses,
	mockYearListing,
	setupUpdateGroupTest,
	yearMetadata,
} from "./updateGroupTestSetup";
import { getListing } from "./utils";

type GroupFileName = "bundle.json" | "test.json";

const historicalSession = {
	id: "2022-01-01 Historical Session",
	name: "2022-01-01 Historical Session",
	group: "test",
	year: "2022",
};
const historicalSessionWithoutYear = {
	id: "2022-01-01 Historical Session",
	name: "2022-01-01 Historical Session",
	group: "test",
};

function readMetadataFixture(path: string) {
	if (path.endsWith(".duration")) return "123";
	if (path.endsWith(".md")) return "Summary from DigitalOcean";
	return "";
}

function mockStandardYearListing() {
	mockYearListing("2024", [
		file(
			"2024-05-05 Test Session.mp4",
			"wasabi/test/2024/2024-05-05 Test Session.mp4",
		),
	]);
}

function mockExistingGroupPath(fileName: GroupFileName) {
	const storedPath = `/local/sync/${fileName}`;
	asMock(storage.exists).mockImplementation(async (path: string) =>
		path.endsWith(storedPath),
	);
	return storedPath;
}

function mockStoredGroupContents(
	fileName: GroupFileName,
	contents: string,
	readOtherFile: (path: string) => string = () => "",
) {
	const storedPath = mockExistingGroupPath(fileName);
	asMock(storage.readFile).mockImplementation(async (path: string) =>
		path.endsWith(storedPath) ? contents : readOtherFile(path),
	);
}

function mockStoredGroupSessions(
	fileName: GroupFileName,
	sessions: unknown,
	readOtherFile?: (path: string) => string,
) {
	mockStoredGroupContents(
		fileName,
		JSON.stringify({ sessions }),
		readOtherFile,
	);
}

function mockCachedTestGroup(
	fileName: GroupFileName,
	sessions: unknown,
	yearFingerprint: string,
	metadataFingerprint: unknown,
	readOtherFile: (path: string) => string = () => "",
) {
	const storedPath = mockExistingGroupPath(fileName);
	asMock(storage.readFile).mockImplementation(async (path: string) => {
		if (path.endsWith(storedPath)) return JSON.stringify({ sessions });
		if (path.includes(".group-update-cache/test/2024.json")) {
			return JSON.stringify({
				fingerprint: yearFingerprint,
				metadataFingerprint: JSON.stringify(metadataFingerprint),
				metadata: emptyYearMetadata(),
			});
		}
		return readOtherFile(path);
	});
}

function expectHistoricalSessionPreserved(sessions: unknown) {
	expect(sessions).toEqual(
		expect.arrayContaining([
			expect.objectContaining({ id: historicalSession.id }),
			expect.objectContaining({ id: "2024-05-05 Test Session" }),
		]),
	);
	expect(addSyncLog).toHaveBeenCalledWith(
		expect.stringContaining("omitted locally stored years (2022)"),
		"warning",
	);
	expect(logger.warn).toHaveBeenCalledWith(
		expect.stringContaining("omitted locally stored years (2022)"),
	);
}

describe("updateGroupProcess persistence and migration", () => {
	beforeEach(() => {
		setupUpdateGroupTest();
	});

	it("preserves older bundled sessions when a full update omits their year", async () => {
		mockStoredGroupSessions("bundle.json", [historicalSession]);

		const sessions = await updateGroupProcess("test", true, false, false, true);

		expectHistoricalSessionPreserved(sessions);
	});

	it("preserves older merged sessions when a full update omits their year", async () => {
		mockStoredGroupSessions("test.json", [historicalSession]);

		await updateGroupProcess("test", true, false, true, false);

		expect(writeCompressedFile).toHaveBeenCalledWith(
			expect.stringMatching(/\/local\/sync\/test\.json$/),
			expect.any(String),
		);
		const [, mergedJson] = asMock(writeCompressedFile).mock.calls[0];
		const mergedData = JSON.parse(mergedJson);
		expectHistoricalSessionPreserved(mergedData.sessions);
		expect(logger.warn).toHaveBeenCalledWith(
			expect.stringContaining("Failed to update local manifest"),
			expect.any(TypeError),
		);
	});

	it("does not replace a bundled group when a year fetch fails", async () => {
		mockStoredGroupSessions("bundle.json", [historicalSession]);
		asMock(getListing).mockImplementation(async (path: any) => {
			if (path === "wasabi/test") {
				return [{ name: "2024", type: "dir", path: "wasabi/test/2024" }];
			}
			if (path === "wasabi/test/2024") {
				throw new Error("temporary listing failure");
			}
			return [];
		});

		const sessions = await updateGroupProcess("test", true, false, false, true);

		expect(sessions).toBeUndefined();
		expect(writeCompressedFile).not.toHaveBeenCalled();
		expect(logger.error).toHaveBeenCalledWith(expect.any(Error));
		expect(logger.error).toHaveBeenCalledWith(
			expect.stringContaining("failed to process all years"),
		);
	});

	it("warns when an existing merged group file cannot be parsed", async () => {
		mockStoredGroupContents("test.json", "{bad");
		mockStandardYearListing();

		await updateGroupProcess("test", true, false, true, false);

		expect(logger.warn).toHaveBeenCalledWith(
			expect.stringContaining("Failed to read existing group file"),
			expect.any(Error),
		);
	});

	it("warns when an existing bundle file cannot be parsed", async () => {
		mockStoredGroupContents("bundle.json", "{bad");
		mockStandardYearListing();

		await updateGroupProcess("test", true, false, false, true);

		expect(logger.warn).toHaveBeenCalledWith(
			expect.stringContaining("Failed to read existing bundle file"),
			expect.any(Error),
		);
	});

	it("infers missing years from session ids when warning about omitted years", async () => {
		mockStoredGroupSessions("bundle.json", [historicalSessionWithoutYear]);

		await updateGroupProcess("test", true, false, false, true);

		expect(addSyncLog).toHaveBeenCalledWith(
			expect.stringContaining("omitted locally stored years (2022)"),
			"warning",
		);
	});

	it("returns early for bundled groups when sessions are unchanged", async () => {
		const yearItems = [
			file(
				"2024-05-05 Test Session.mp4",
				"wasabi/test/2024/2024-05-05 Test Session.mp4",
			),
		];
		const metadataFingerprint = [null, null, null, null];
		const yearFingerprint = getCombinedYearFingerprint(
			yearItems,
			metadataFingerprint,
		);
		asMock(storage.exists).mockImplementation(async (path: any) =>
			path.endsWith("/local/sync/bundle.json"),
		);

		const sessions = await updateGroupProcess("test", true, false, false, true);
		expect(sessions).toHaveLength(1);

		jest.clearAllMocks();
		mockCachedTestGroup(
			"bundle.json",
			sessions,
			yearFingerprint,
			metadataFingerprint,
		);
		mockYearListing("2024", yearItems);

		const secondRun = await updateGroupProcess(
			"test",
			true,
			false,
			false,
			true,
		);

		expect(addSyncLog).toHaveBeenCalledWith(
			expect.stringContaining("Verified (no changes)"),
			"success",
		);
		expect(fetchSessionMetadata).not.toHaveBeenCalled();
		expect(secondRun).toEqual(sessions);
	});

	it("returns early for merged groups when sessions are unchanged", async () => {
		const yearItems = [
			file(
				"2024-05-05 Test Session.mp4",
				"wasabi/test/2024/2024-05-05 Test Session.mp4",
			),
		];
		const metadataFingerprint = [null, null, null, null];
		const yearFingerprint = getCombinedYearFingerprint(
			yearItems,
			metadataFingerprint,
		);
		mockStoredGroupSessions("test.json", [], readMetadataFixture);

		await updateGroupProcess("test", true, false, true, false);
		const writtenPayload = asMock(writeCompressedFile).mock.calls.at(-1)[1];
		const writtenSessions =
			typeof writtenPayload === "string"
				? JSON.parse(writtenPayload).sessions
				: writtenPayload.sessions;

		jest.clearAllMocks();
		mockCachedTestGroup(
			"test.json",
			writtenSessions,
			yearFingerprint,
			metadataFingerprint,
			readMetadataFixture,
		);
		mockYearListing("2024", yearItems);

		await updateGroupProcess("test", true, false, true, false);

		expect(addSyncLog).toHaveBeenCalledWith(
			expect.stringContaining("Verified (no changes)"),
			"success",
		);
		expect(fetchSessionMetadata).not.toHaveBeenCalled();
		expect(writeCompressedFile).not.toHaveBeenCalled();
	});

	it("updates the local manifest after writing a merged group file", async () => {
		asMock(getFileInfo).mockResolvedValue({ hash: "merged-hash", size: 2048 });
		asMock(updateManifestEntry).mockResolvedValue(undefined);
		asMock(storage.readFile).mockImplementation(async (path: any) => {
			if (path.endsWith("/local/sync/test.json")) {
				return JSON.stringify({ sessions: [] });
			}
			if (path.endsWith(".duration")) return "123";
			if (path.endsWith(".md")) return "Summary from DigitalOcean";
			return "";
		});

		await updateGroupProcess("test", true, false, true, false);

		expect(updateManifestEntry).toHaveBeenCalledWith(
			expect.stringContaining("/local/sync/files.json"),
			expect.objectContaining({
				hash: "merged-hash",
				size: 2048,
			}),
		);
		expect(logger.debug).toHaveBeenCalledWith(
			expect.stringContaining("Updated local manifest"),
		);
	});

	it("records bundled new session metadata when sessions are added", async () => {
		mockStoredGroupSessions("bundle.json", []);
		mockYearListing("2024", [
			file(
				"2024-05-05 Test Session.mp4",
				"wasabi/test/2024/2024-05-05 Test Session.mp4",
			),
			file(
				"2024-05-05 Test Session.jpg",
				"wasabi/test/2024/2024-05-05 Test Session.jpg",
			),
		]);
		asMock(fetchSessionMetadata).mockResolvedValue(
			yearMetadata({
				tags: { "2024-05-05 Test Session": ["bundle"] },
				durations: { "2024-05-05 Test Session": 90 },
				summaries: { "2024-05-05 Test Session": "Bundled summary" },
				transcriptions: { "2024-05-05 Test Session": true },
			}),
		);

		await updateGroupProcess("test", true, false, false, true);

		const status = groupUpdateStatus();
		expect(status.addedCount).toBe(1);
		expect(status.newSessions[0].metadata).toEqual({
			hasTags: true,
			hasDuration: true,
			hasSummary: true,
			hasTranscription: true,
			hasThumbnail: true,
		});
	});

	it("records merged new session metadata when sessions are added", async () => {
		mockStoredGroupSessions("test.json", [], readMetadataFixture);
		mockListingResponses({
			"wasabi/test": [{ name: "2024", type: "dir", path: "wasabi/test/2024" }],
			"wasabi/test/2024": [
				file(
					"2024-05-05 Test Session.mp4",
					"wasabi/test/2024/2024-05-05 Test Session.mp4",
				),
				file(
					"2024-05-05 Test Session.png",
					"/aws/sessions/test/2024/2024-05-05 Test Session.png",
				),
			],
		});
		asMock(fetchSessionMetadata).mockResolvedValue(
			yearMetadata({
				items: [
					file(
						"2024-05-05 Test Session.png",
						"/aws/sessions/test/2024/2024-05-05 Test Session.png",
					),
				],
				tags: { "2024-05-05 Test Session": ["merged"] },
				durations: { "2024-05-05 Test Session": 75 },
				summaries: { "2024-05-05 Test Session": "Merged summary" },
				transcriptions: { "2024-05-05 Test Session": true },
			}),
		);

		await updateGroupProcess("test", true, false, true, false);

		const status = groupUpdateStatus();
		expect(status.addedCount).toBe(1);
		expect(status.newSessions[0].metadata).toEqual({
			hasTags: true,
			hasDuration: true,
			hasSummary: true,
			hasTranscription: true,
			hasThumbnail: true,
		});
	});

	it("forces bundled updates even when session payloads are unchanged", async () => {
		const sessions = [
			{
				id: "2024-05-05 Test Session",
				name: "Test Session",
				group: "test",
				year: "2024",
			},
		];
		mockStoredGroupSessions("bundle.json", sessions);
		mockStandardYearListing();

		const result = await updateGroupProcess("test", true, true, false, true);

		expect(result).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ id: "2024-05-05 Test Session" }),
			]),
		);
		expect(addSyncLog).not.toHaveBeenCalledWith(
			expect.stringContaining("Verified (no changes)"),
			"success",
		);
	});

	it("records bundled additions without thumbnails when no image is present", async () => {
		mockStoredGroupSessions("bundle.json", []);
		mockStandardYearListing();
		asMock(fetchSessionMetadata).mockResolvedValue(
			yearMetadata({
				tags: { "2024-05-05 Test Session": ["bundle"] },
				durations: { "2024-05-05 Test Session": 1 },
			}),
		);

		await updateGroupProcess("test", true, false, false, true);

		const status = groupUpdateStatus();
		expect(status.newSessions[0].metadata.hasThumbnail).toBe(false);
	});

	it("records merged additions without thumbnails when no image is present", async () => {
		mockStoredGroupSessions("test.json", []);
		mockStandardYearListing();
		asMock(fetchSessionMetadata).mockResolvedValue(
			yearMetadata({
				tags: { "2024-05-05 Test Session": ["merged"] },
				durations: { "2024-05-05 Test Session": 1 },
			}),
		);

		await updateGroupProcess("test", true, false, true, false);

		const status = groupUpdateStatus();
		expect(status.newSessions[0].metadata.hasThumbnail).toBe(false);
	});

	it("reads bundled group files that exist but omit a sessions array", async () => {
		mockStoredGroupContents("bundle.json", JSON.stringify({ version: 1 }));
		mockStandardYearListing();

		const sessions = await updateGroupProcess("test", true, false, false, true);

		expect(sessions).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ id: "2024-05-05 Test Session" }),
			]),
		);
	});

	it("reads merged group files that exist but omit a sessions array", async () => {
		mockStoredGroupContents("test.json", JSON.stringify({ version: 1 }));
		mockStandardYearListing();

		await updateGroupProcess("test", true, false, true, false);

		expect(writeCompressedFile).toHaveBeenCalled();
	});
});
