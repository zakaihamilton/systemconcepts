import { readBinary } from "@util/data/binary";
import { blobToBase64, shrinkImage } from "@util/data/image";
import storage from "@util/storage/storage";
import {
	loadDurations,
	loadSummaries,
	loadTags,
	loadTranscriptions,
} from "./metadata";
import { fetchSessionMetadata } from "./sessionMetadataClient";
import { updateGroupProcess } from "./updateGroup";
import { getListing, updateYearSync } from "./utils";

jest.mock("@sync/bundle", () => ({
	writeCompressedFile: jest.fn(),
}));
jest.mock("@sync/hash", () => ({
	getFileInfo: jest.fn(),
}));
jest.mock("@sync/manifest", () => ({
	updateManifestEntry: jest.fn(),
}));
jest.mock("@sync/sync", () => ({
	addSyncLog: jest.fn(),
}));
jest.mock("@util/data/binary", () => ({
	readBinary: jest.fn(),
}));
jest.mock("@util/data/image", () => ({
	blobToBase64: jest.fn(),
	shrinkImage: jest.fn(),
}));
jest.mock("@util/storage/storage", () => ({
	deleteFile: jest.fn(),
	exists: jest.fn(),
	readFile: jest.fn(),
}));
jest.mock("./cleanup", () => ({
	cleanupBundledGroup: jest.fn(),
	cleanupMergedGroup: jest.fn(),
}));
jest.mock("./metadata", () => ({
	loadDurations: jest.fn(),
	loadSummaries: jest.fn(),
	loadTags: jest.fn(),
	loadTranscriptions: jest.fn(),
}));
jest.mock("./sessionMetadataClient", () => ({
	fetchSessionMetadata: jest.fn(),
}));
jest.mock("./utils", () => ({
	getListing: jest.fn(),
	updateBundleFile: jest.fn(),
	updateYearSync: jest.fn(),
}));

function file(name, path) {
	return { name, path };
}

describe("updateGroupProcess", () => {
	beforeEach(() => {
		jest.clearAllMocks();

		storage.exists.mockResolvedValue(false);
		storage.readFile.mockImplementation(async (path) => {
			if (path.endsWith(".duration")) return "123";
			if (path.endsWith(".md")) return "Summary from DigitalOcean";
			if (path.endsWith(".tags")) return JSON.stringify(["ai", "sync"]);
			return "";
		});
		readBinary.mockResolvedValue(new Blob(["image"]));
		shrinkImage.mockImplementation(async (blob) => blob);
		blobToBase64.mockResolvedValue("thumbnail");

		loadTags.mockResolvedValue({});
		loadDurations.mockResolvedValue({});
		loadSummaries.mockResolvedValue({});
		loadTranscriptions.mockResolvedValue({});
		fetchSessionMetadata.mockResolvedValue({
			items: [
				file(
					"2024-05-05 Test Session.duration",
					"/aws/sessions/test/2024/2024-05-05 Test Session.duration",
				),
				file(
					"2024-05-05 Test Session.md",
					"/aws/sessions/test/2024/2024-05-05 Test Session.md",
				),
				file(
					"2024-05-05 Test Session.txt",
					"/aws/sessions/test/2024/2024-05-05 Test Session.txt",
				),
				file(
					"2024-05-05 Test Session.en.vtt",
					"/aws/sessions/test/2024/2024-05-05 Test Session.en.vtt",
				),
				file(
					"2024-05-05 Test Session.png",
					"/aws/sessions/test/2024/2024-05-05 Test Session.png",
				),
				file(
					"2024-05-06 Metadata Only.txt",
					"/aws/sessions/test/2024/2024-05-06 Metadata Only.txt",
				),
			],
			tags: {},
			durations: {},
			summaries: {},
			transcriptions: {},
		});

		getListing.mockImplementation(async (path) => {
			if (path === "wasabi/test") {
				return [{ name: "2024", type: "dir", path: "wasabi/test/2024" }];
			}
			if (path === "wasabi/test/2024") {
				return [
					file(
						"2024-05-05 Test Session.mp4",
						"wasabi/test/2024/2024-05-05 Test Session.mp4",
					),
					file(
						"2024-05-05 Test Session.jpg",
						"wasabi/test/2024/2024-05-05 Test Session.jpg",
					),
				];
			}
			if (path === "/aws/sessions/test/2024") {
				return [
					file(
						"2024-05-05 Test Session.duration",
						"/aws/sessions/test/2024/2024-05-05 Test Session.duration",
					),
					file(
						"2024-05-05 Test Session.md",
						"/aws/sessions/test/2024/2024-05-05 Test Session.md",
					),
					file(
						"2024-05-05 Test Session.txt",
						"/aws/sessions/test/2024/2024-05-05 Test Session.txt",
					),
					file(
						"2024-05-05 Test Session.en.vtt",
						"/aws/sessions/test/2024/2024-05-05 Test Session.en.vtt",
					),
					file(
						"2024-05-05 Test Session.png",
						"/aws/sessions/test/2024/2024-05-05 Test Session.png",
					),
					file(
						"2024-05-06 Metadata Only.txt",
						"/aws/sessions/test/2024/2024-05-06 Metadata Only.txt",
					),
				];
			}
			return [];
		});

		updateYearSync.mockResolvedValue({
			counter: 0,
			newCount: 0,
			newSessions: [],
		});
	});

	it("combines Wasabi media with DigitalOcean metadata and preferred images", async () => {
		await updateGroupProcess("test", true);

		expect(fetchSessionMetadata).toHaveBeenCalledTimes(1);
		expect(fetchSessionMetadata).toHaveBeenCalledWith(
			"test",
			"2024",
			expect.any(Array),
			expect.any(Boolean),
		);
		expect(updateYearSync).toHaveBeenCalledTimes(1);
		const [, year, sessions] = updateYearSync.mock.calls[0];
		expect(year).toBe("2024");
		expect(sessions).toHaveLength(1);

		const [session] = sessions;
		expect(session.id).toBe("2024-05-05 Test Session");
		expect(session.video.path).toBe(
			"wasabi/test/2024/2024-05-05 Test Session.mp4",
		);
		expect(session.image.path).toBe(
			"/aws/sessions/test/2024/2024-05-05 Test Session.png",
		);
		expect(session.duration).toBe(123);
		expect(session.summaryText).toBe("Summary from DigitalOcean");
		expect(session.transcription).toBe(true);
		expect(session.transcriptPath).toBe(
			"/aws/sessions/test/2024/2024-05-05 Test Session.txt",
		);
		expect(session.subtitles.path).toBe(
			"/aws/sessions/test/2024/2024-05-05 Test Session.en.vtt",
		);
		expect(session.thumbnail).toBe("thumbnail");
	});

	it("falls back to legacy metadata loaders when aggregated metadata fails", async () => {
		fetchSessionMetadata.mockRejectedValueOnce(new Error("backend busy"));
		loadTags.mockResolvedValue({ "2024-05-05 Test Session": ["legacy"] });
		loadDurations.mockResolvedValue({ "2024-05-05 Test Session": 456 });
		loadSummaries.mockResolvedValue({
			"2024-05-05 Test Session": "Legacy summary",
		});
		loadTranscriptions.mockResolvedValue({
			"2024-05-05 Test Session": true,
		});

		await updateGroupProcess("test", true);

		expect(loadTags).toHaveBeenCalledTimes(1);
		expect(loadDurations).toHaveBeenCalledTimes(1);
		expect(loadSummaries).toHaveBeenCalledTimes(1);
		expect(loadTranscriptions).toHaveBeenCalledTimes(1);
		const [, , sessions] = updateYearSync.mock.calls[0];
		expect(sessions[0].tags).toEqual(["legacy"]);
		expect(sessions[0].duration).toBe(456);
		expect(sessions[0].summaryText).toBe("Legacy summary");
		expect(sessions[0].transcription).toBe(true);
	});

	it("uses cached metadata for non-forced updates without calling the aggregated endpoint", async () => {
		const currentYear = String(new Date().getFullYear());
		getListing.mockImplementation(async (path) => {
			if (path === "wasabi/test") {
				return [
					{
						name: currentYear,
						type: "dir",
						path: `wasabi/test/${currentYear}`,
					},
				];
			}
			if (path === `wasabi/test/${currentYear}`) {
				return [
					file(
						`${currentYear}-05-05 Cached Session.mp4`,
						`wasabi/test/${currentYear}/${currentYear}-05-05 Cached Session.mp4`,
					),
				];
			}
			return [];
		});
		storage.exists.mockImplementation(async (path) =>
			path.endsWith(`test/${currentYear}.json`),
		);
		storage.readFile.mockImplementation(async (path) => {
			if (path.endsWith(`test/${currentYear}.json`)) {
				return JSON.stringify({
					sessions: [
						{
							id: `${currentYear}-05-05 Cached Session`,
							name: `${currentYear}-05-05 Cached Session`,
							group: "test",
							tags: ["cached"],
							duration: 321,
							summaryText: "Cached summary",
							transcription: true,
						},
					],
				});
			}
			return "";
		});

		await updateGroupProcess("test", false, false);

		expect(fetchSessionMetadata).not.toHaveBeenCalled();
		expect(loadTags).not.toHaveBeenCalled();
		expect(loadDurations).not.toHaveBeenCalled();
		expect(loadSummaries).not.toHaveBeenCalled();
		expect(loadTranscriptions).not.toHaveBeenCalled();

		const [, year, sessions] = updateYearSync.mock.calls[0];
		expect(year).toBe(currentYear);
		expect(sessions[0].tags).toEqual(["cached"]);
		expect(sessions[0].duration).toBe(321);
		expect(sessions[0].summaryText).toBe("Cached summary");
		expect(sessions[0].transcription).toBe(true);
	});
});
