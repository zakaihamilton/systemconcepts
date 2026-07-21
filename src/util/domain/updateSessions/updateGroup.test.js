import { writeCompressedFile } from "@sync/bundle";
import { addSyncLog } from "@sync/sync";
import { logger } from "@util/api/logger";
import storage from "@util/storage/storage";
import { getCombinedYearFingerprint } from "./fingerprints";
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
jest.mock("@util/api/logger", () => ({
	logger: {
		debug: jest.fn(),
		error: jest.fn(),
		info: jest.fn(),
		warn: jest.fn(),
	},
}));
jest.mock("@util/storage/storage", () => ({
	createFolderPath: jest.fn(),
	deleteFile: jest.fn(),
	exists: jest.fn(),
	readFile: jest.fn(),
	writeFile: jest.fn(),
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

	it("combines Wasabi media with DigitalOcean metadata and prefers Wasabi images", async () => {
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
			"wasabi/test/2024/2024-05-05 Test Session.jpg",
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
		expect(session.thumbnail).toBe(true);
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
		expect(logger.warn).toHaveBeenCalledWith(
			expect.stringContaining("Aggregated metadata fetch failed"),
			expect.any(Error),
		);
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
		const localYearPath = `/local/sync/test/${currentYear}.json`;
		storage.exists.mockImplementation(async (path) => path === localYearPath);
		storage.readFile.mockImplementation(async (path) => {
			if (path.includes(".group-update-cache")) {
				return "";
			}
			if (path === localYearPath) {
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

	it("does not skip year when fingerprint matches but local sessions miss listing media", async () => {
		const currentYear = String(new Date().getFullYear());
		const existingId = `${currentYear}-07-17 Overview - Kabbalah & Suffering`;
		const newId = `${currentYear}-07-20 Overview - The Grip & Shells`;
		const yearItems = [
			file(
				`${existingId}.mp4`,
				`wasabi/test/${currentYear}/${existingId}.mp4`,
			),
			file(`${newId}.mp4`, `wasabi/test/${currentYear}/${newId}.mp4`),
		];
		const metadataFingerprint = [null, null, null, null];
		const yearFingerprint = getCombinedYearFingerprint(
			yearItems,
			metadataFingerprint,
		);
		const localYearPath = `/local/sync/test/${currentYear}.json`;

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
				return yearItems;
			}
			if (path === "/aws/sessions/test") {
				return [];
			}
			return [];
		});

		storage.exists.mockImplementation(async (path) => path === localYearPath);
		storage.readFile.mockImplementation(async (path) => {
			if (path.includes(`.group-update-cache/test/${currentYear}.json`)) {
				return JSON.stringify({
					fingerprint: yearFingerprint,
					metadataFingerprint: JSON.stringify(metadataFingerprint),
					metadata: {
						items: [],
						tags: {},
						durations: {},
						summaries: {},
						transcriptions: {},
					},
				});
			}
			if (path === localYearPath) {
				return JSON.stringify({
					sessions: [
						{
							id: existingId,
							name: existingId,
							group: "test",
							year: currentYear,
						},
					],
				});
			}
			return "";
		});
		fetchSessionMetadata.mockResolvedValue({
			items: [],
			tags: {},
			durations: {},
			summaries: {},
			transcriptions: {},
		});
		updateYearSync.mockResolvedValue({
			counter: 1,
			newCount: 1,
			newSessions: [{ id: newId }],
		});

		await updateGroupProcess("test", false, false);

		expect(addSyncLog).not.toHaveBeenCalledWith(
			expect.stringContaining("Skipped unchanged year"),
			expect.anything(),
		);
		expect(updateYearSync).toHaveBeenCalledTimes(1);
		const [, year, sessions] = updateYearSync.mock.calls[0];
		expect(year).toBe(currentYear);
		expect(sessions.map((session) => session.id)).toEqual(
			expect.arrayContaining([existingId, newId]),
		);
	});

	it("skips remote metadata fetch when year cache metadata fingerprint is unchanged", async () => {
		const metadataFiles = [
			{ name: "2024.tags", size: 100, mtimeMs: 1 },
			{ name: "2024.duration", size: 100, mtimeMs: 1 },
			{ name: "2024.md", size: 100, mtimeMs: 1 },
			{ name: "2024.zip", size: 100, mtimeMs: 1 },
		];
		const metadataFingerprint = [
			{ name: "2024.tags", type: "", size: 100, mtimeMs: 1 },
			{ name: "2024.duration", type: "", size: 100, mtimeMs: 1 },
			{ name: "2024.md", type: "", size: 100, mtimeMs: 1 },
			{ name: "2024.zip", type: "", size: 100, mtimeMs: 1 },
		];

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
						"2024-05-06 New Session.mp4",
						"wasabi/test/2024/2024-05-06 New Session.mp4",
					),
				];
			}
			if (path === "/aws/sessions/test") {
				return metadataFiles;
			}
			return [];
		});

		storage.readFile.mockImplementation(async (path) => {
			if (path.includes(".group-update-cache/test/2024.json")) {
				return JSON.stringify({
					fingerprint: "stale-combined-fingerprint",
					metadataFingerprint: JSON.stringify(metadataFingerprint),
					metadata: {
						items: [
							file(
								"2024-05-05 Test Session.png",
								"/aws/sessions/test/2024/2024-05-05 Test Session.png",
							),
						],
						tags: { "2024-05-05 Test Session": ["cached-tag"] },
						durations: { "2024-05-05 Test Session": 999 },
						summaries: { "2024-05-05 Test Session": "Cached summary" },
						transcriptions: { "2024-05-05 Test Session": true },
					},
				});
			}
			return "";
		});

		await updateGroupProcess("test", true, false);

		expect(fetchSessionMetadata).not.toHaveBeenCalled();
		const [, , sessions] = updateYearSync.mock.calls[0];
		expect(sessions[0].tags).toEqual(["cached-tag"]);
		expect(sessions[0].duration).toBe(999);
		expect(sessions[0].summaryText).toBe("Cached summary");
	});

	it("fetches remote metadata on forceUpdate when metadata fingerprint is unchanged", async () => {
		const metadataFingerprint = [
			{ name: "2024.tags", type: "", size: 100, mtimeMs: 1 },
			{ name: "2024.duration", type: "", size: 100, mtimeMs: 1 },
			{ name: "2024.md", type: "", size: 100, mtimeMs: 1 },
			{ name: "2024.zip", type: "", size: 100, mtimeMs: 1 },
		];

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
				];
			}
			if (path === "/aws/sessions/test") {
				return [
					{ name: "2024.tags", size: 100, mtimeMs: 1 },
					{ name: "2024.duration", size: 100, mtimeMs: 1 },
					{ name: "2024.md", size: 100, mtimeMs: 1 },
					{ name: "2024.zip", size: 100, mtimeMs: 1 },
				];
			}
			return [];
		});

		storage.readFile.mockImplementation(async (path) => {
			if (path.includes(".group-update-cache/test/2024.json")) {
				return JSON.stringify({
					fingerprint: "stale-combined-fingerprint",
					metadataFingerprint: JSON.stringify(metadataFingerprint),
					metadata: {
						items: [],
						tags: { "2024-05-05 Test Session": ["forced-cache"] },
						durations: { "2024-05-05 Test Session": 555 },
						summaries: {},
						transcriptions: {},
					},
				});
			}
			return "";
		});
		fetchSessionMetadata.mockResolvedValueOnce({
			items: [],
			tags: { "2024-05-05 Test Session": ["fresh"] },
			durations: { "2024-05-05 Test Session": 123 },
			summaries: {},
			transcriptions: {},
		});

		await updateGroupProcess("test", true, true);

		expect(fetchSessionMetadata).toHaveBeenCalledWith(
			"test",
			"2024",
			expect.any(Array),
			true,
		);
		const [, , sessions] = updateYearSync.mock.calls[0];
		expect(sessions[0].tags).toEqual(["fresh"]);
		expect(sessions[0].duration).toBe(123);
	});

	it("fetches remote metadata when metadata fingerprint changes", async () => {
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
				];
			}
			if (path === "/aws/sessions/test") {
				return [{ name: "2024.tags", size: 200, mtimeMs: 2 }];
			}
			return [];
		});

		storage.readFile.mockImplementation(async (path) => {
			if (path.includes(".group-update-cache/test/2024.json")) {
				return JSON.stringify({
					fingerprint: "old",
					metadataFingerprint: JSON.stringify([
						{ name: "2024.tags", type: "", size: 100, mtimeMs: 1 },
					]),
					metadata: {
						items: [],
						tags: { "2024-05-05 Test Session": ["stale"] },
						durations: {},
						summaries: {},
						transcriptions: {},
					},
				});
			}
			return "";
		});

		await updateGroupProcess("test", true, false);

		expect(fetchSessionMetadata).toHaveBeenCalledTimes(1);
	});

	it("updates only recent sessions while preserving cached sessions from the same year", async () => {
		const currentYear = String(new Date().getFullYear());
		const recentDate = new Date(Date.now() - 24 * 60 * 60 * 1000)
			.toISOString()
			.slice(0, 10);
		const oldSession = {
			id: `${currentYear}-01-01 Historical Session`,
			name: `${currentYear}-01-01 Historical Session`,
			group: "test",
			year: currentYear,
			tags: ["preserve"],
		};
		const recentId = `${recentDate} Recent Session`;
		const localYearPath = `/local/sync/test/${currentYear}.json`;

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
						`${oldSession.id}.mp4`,
						`wasabi/test/${currentYear}/${oldSession.id}.mp4`,
					),
					file(`${recentId}.mp4`, `wasabi/test/${currentYear}/${recentId}.mp4`),
				];
			}
			return [];
		});
		storage.exists.mockImplementation(async (path) => path === localYearPath);
		storage.readFile.mockImplementation(async (path) => {
			if (path === localYearPath)
				return JSON.stringify({ sessions: [oldSession] });
			return "";
		});
		fetchSessionMetadata.mockResolvedValue({
			items: [],
			tags: { [recentId]: ["recent"] },
			durations: {},
			summaries: {},
			transcriptions: {},
		});

		await updateGroupProcess("test", false, true, false, false, null, 30);

		const [, year, sessions] = updateYearSync.mock.calls[0];
		expect(year).toBe(currentYear);
		expect(sessions).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ id: oldSession.id, tags: ["preserve"] }),
				expect.objectContaining({ id: recentId, tags: ["recent"] }),
			]),
		);
		expect(sessions).toHaveLength(2);
	});

	it("preserves older bundled sessions when a full update omits their year", async () => {
		const oldSession = {
			id: "2022-01-01 Historical Session",
			name: "2022-01-01 Historical Session",
			group: "test",
			year: "2022",
		};
		storage.exists.mockImplementation(async (path) =>
			path.endsWith("/local/sync/bundle.json"),
		);
		storage.readFile.mockImplementation(async (path) => {
			if (path.endsWith("/local/sync/bundle.json")) {
				return JSON.stringify({ sessions: [oldSession] });
			}
			return "";
		});

		const sessions = await updateGroupProcess("test", true, false, false, true);

		expect(sessions).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ id: oldSession.id }),
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
	});

	it("preserves older merged sessions when a full update omits their year", async () => {
		const oldSession = {
			id: "2022-01-01 Historical Session",
			name: "2022-01-01 Historical Session",
			group: "test",
			year: "2022",
		};
		storage.exists.mockImplementation(async (path) =>
			path.endsWith("/local/sync/test.json"),
		);
		storage.readFile.mockImplementation(async (path) => {
			if (path.endsWith("/local/sync/test.json")) {
				return JSON.stringify({ sessions: [oldSession] });
			}
			return "";
		});

		await updateGroupProcess("test", true, false, true, false);

		expect(writeCompressedFile).toHaveBeenCalledWith(
			expect.stringMatching(/\/local\/sync\/test\.json$/),
			expect.objectContaining({
				sessions: expect.arrayContaining([
					expect.objectContaining({ id: oldSession.id }),
					expect.objectContaining({ id: "2024-05-05 Test Session" }),
				]),
			}),
		);
		expect(addSyncLog).toHaveBeenCalledWith(
			expect.stringContaining("omitted locally stored years (2022)"),
			"warning",
		);
		expect(logger.warn).toHaveBeenCalledWith(
			expect.stringContaining("omitted locally stored years (2022)"),
		);
		expect(logger.warn).toHaveBeenCalledWith(
			expect.stringContaining("Failed to update local manifest"),
			expect.any(TypeError),
		);
	});

	it("does not replace a bundled group when a year fetch fails", async () => {
		const oldSession = {
			id: "2022-01-01 Historical Session",
			name: "2022-01-01 Historical Session",
			group: "test",
			year: "2022",
		};
		storage.exists.mockImplementation(async (path) =>
			path.endsWith("/local/sync/bundle.json"),
		);
		storage.readFile.mockImplementation(async (path) => {
			if (path.endsWith("/local/sync/bundle.json")) {
				return JSON.stringify({ sessions: [oldSession] });
			}
			return "";
		});
		getListing.mockImplementation(async (path) => {
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
});
