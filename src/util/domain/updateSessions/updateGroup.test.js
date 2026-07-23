import { writeCompressedFile } from "@sync/bundle";
import { getFileInfo } from "@sync/hash";
import { updateManifestEntry } from "@sync/manifest";
import { addSyncLog } from "@sync/sync";
import { SyncActiveStore, UpdateSessionsStore } from "@sync/syncState";
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
	yieldToMain: jest.fn(() => Promise.resolve()),
}));

function file(name, path) {
	return { name, path };
}

describe("updateGroupProcess", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		UpdateSessionsStore.update((s) => {
			s.status = [];
		});
		SyncActiveStore.update((s) => {
			s.needsSessionReload = false;
		});

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

	it("skips legacy metadata fallback after a metadata timeout", async () => {
		fetchSessionMetadata.mockRejectedValueOnce(
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
			file(`${existingId}.mp4`, `wasabi/test/${currentYear}/${existingId}.mp4`),
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
		expect(addSyncLog).toHaveBeenCalledWith(
			expect.stringContaining("Refreshing 1 changed session(s)"),
			"info",
		);
		// Fingerprint matched — reuse cached metadata instead of refetching.
		expect(fetchSessionMetadata).not.toHaveBeenCalled();
		expect(updateYearSync).toHaveBeenCalledTimes(1);
		const [, year, sessions] = updateYearSync.mock.calls[0];
		expect(year).toBe(currentYear);
		expect(sessions.map((session) => session.id)).toEqual(
			expect.arrayContaining([existingId, newId]),
		);
		expect(UpdateSessionsStore.getRawState().status[0].sessionCount).toBe(0);
	});

	it("only rematerializes changed sessions when year fingerprint changes", async () => {
		const currentYear = String(new Date().getFullYear());
		const existingId = `${currentYear}-07-17 Overview - Kabbalah & Suffering`;
		const newId = `${currentYear}-07-23 Conclusion`;
		const yearItems = [
			{
				name: `${existingId}.mp4`,
				path: `wasabi/test/${currentYear}/${existingId}.mp4`,
				stat: { type: "file", size: 10, mtimeMs: 1 },
			},
			{
				name: `${newId}.mp4`,
				path: `wasabi/test/${currentYear}/${newId}.mp4`,
				stat: { type: "file", size: 20, mtimeMs: 2 },
			},
		];
		const metadataFingerprint = [null, null, null, null];
		const staleFingerprint = getCombinedYearFingerprint(
			[yearItems[0]],
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
			return [];
		});
		storage.exists.mockImplementation(async (path) => path === localYearPath);
		storage.readFile.mockImplementation(async (path) => {
			if (path.includes(`.group-update-cache/test/${currentYear}.json`)) {
				return JSON.stringify({
					fingerprint: staleFingerprint,
					metadataFingerprint: JSON.stringify(metadataFingerprint),
					sessionFingerprints: {
						[existingId]: JSON.stringify([
							{
								name: `${existingId}.mp4`,
								type: "file",
								size: 10,
								mtimeMs: 1,
							},
						]),
					},
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
							files: [`${existingId}.mp4`],
							tags: ["keep"],
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

		expect(addSyncLog).toHaveBeenCalledWith(
			expect.stringContaining("Refreshing 1 changed session(s)"),
			"info",
		);
		expect(updateYearSync).toHaveBeenCalledTimes(1);
		const [, , sessions] = updateYearSync.mock.calls[0];
		expect(sessions.map((session) => session.id).sort()).toEqual(
			[existingId, newId].sort(),
		);
		const kept = sessions.find((session) => session.id === existingId);
		expect(kept.tags).toEqual(["keep"]);
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
			expect.any(String),
		);
		const [, mergedJson] = writeCompressedFile.mock.calls[0];
		const mergedData = JSON.parse(mergedJson);
		expect(mergedData.sessions).toEqual(
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

	it("aborts when the group listing fails", async () => {
		getListing.mockRejectedValue(new Error("listing down"));

		await expect(updateGroupProcess("test", true)).resolves.toBeUndefined();
		expect(updateYearSync).not.toHaveBeenCalled();
		expect(logger.error).toHaveBeenCalledWith(expect.any(Error));
	});

	it("logs a targeted sync and refreshes the matching session", async () => {
		const currentYear = String(new Date().getFullYear());
		const keepId = `${currentYear}-01-01 Keep Session`;
		const targetId = `${currentYear}-02-02 Target Session`;
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
					file(`${keepId}.mp4`, `wasabi/test/${currentYear}/${keepId}.mp4`),
					file(`${targetId}.mp4`, `wasabi/test/${currentYear}/${targetId}.mp4`),
				];
			}
			return [];
		});
		storage.exists.mockImplementation(async (path) => path === localYearPath);
		storage.readFile.mockImplementation(async (path) => {
			if (path === localYearPath) {
				return JSON.stringify({
					sessions: [
						{
							id: keepId,
							name: keepId,
							group: "test",
							year: currentYear,
							tags: ["keep"],
						},
						{
							id: targetId,
							name: targetId,
							group: "test",
							year: currentYear,
							tags: ["stale"],
						},
					],
				});
			}
			return "";
		});
		fetchSessionMetadata.mockResolvedValue({
			items: [],
			tags: { [targetId]: ["fresh"], [keepId]: ["keep"] },
			durations: {},
			summaries: {},
			transcriptions: {},
		});

		await updateGroupProcess(
			"test",
			false,
			false,
			false,
			false,
			targetId,
			null,
		);

		expect(addSyncLog).toHaveBeenCalledWith(
			expect.stringContaining(
				`Targeted sync requested for session: ${targetId}`,
			),
			"info",
		);
		expect(addSyncLog).toHaveBeenCalledWith(
			expect.stringContaining(
				`Force re-fetching metadata for targeted session: ${targetId}`,
			),
			"info",
		);
		const [, , sessions] = updateYearSync.mock.calls[0];
		expect(sessions.map((s) => s.id).sort()).toEqual([keepId, targetId].sort());
		expect(sessions.find((s) => s.id === keepId).tags).toEqual(["keep"]);
	});

	it("skips an unchanged year when fingerprint and sessions match", async () => {
		const currentYear = String(new Date().getFullYear());
		const sessionId = `${currentYear}-03-03 Unchanged Session`;
		const yearItems = [
			file(`${sessionId}.mp4`, `wasabi/test/${currentYear}/${sessionId}.mp4`),
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
							id: sessionId,
							name: sessionId,
							group: "test",
							year: currentYear,
						},
					],
				});
			}
			return "";
		});

		await updateGroupProcess("test", false, false);

		expect(updateYearSync).not.toHaveBeenCalled();
		expect(addSyncLog).toHaveBeenCalledWith(
			expect.stringContaining("Skipped unchanged year"),
			"info",
		);
	});

	it("warns when an existing merged group file cannot be parsed", async () => {
		storage.exists.mockImplementation(async (path) =>
			path.endsWith("/local/sync/test.json"),
		);
		storage.readFile.mockImplementation(async (path) => {
			if (path.endsWith("/local/sync/test.json")) return "{bad";
			return "";
		});
		getListing.mockResolvedValue([
			{ name: "2024", type: "dir", path: "wasabi/test/2024" },
		]);
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
			return [];
		});

		await updateGroupProcess("test", true, false, true, false);

		expect(logger.warn).toHaveBeenCalledWith(
			expect.stringContaining("Failed to read existing group file"),
			expect.any(Error),
		);
	});

	it("warns when an existing bundle file cannot be parsed", async () => {
		storage.exists.mockImplementation(async (path) =>
			path.endsWith("/local/sync/bundle.json"),
		);
		storage.readFile.mockImplementation(async (path) => {
			if (path.endsWith("/local/sync/bundle.json")) return "{bad";
			return "";
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
				];
			}
			return [];
		});

		await updateGroupProcess("test", true, false, false, true);

		expect(logger.warn).toHaveBeenCalledWith(
			expect.stringContaining("Failed to read existing bundle file"),
			expect.any(Error),
		);
	});

	it("migrates leftover years from a merged file when switching to split", async () => {
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
			return [];
		});
		storage.exists.mockImplementation(async (path) => {
			return (
				path.endsWith("/local/sync/test.json") ||
				path.endsWith("/aws/sync/test.json.gz")
			);
		});
		storage.readFile.mockImplementation(async (path) => {
			if (path.endsWith("/local/sync/test.json")) {
				return JSON.stringify({
					sessions: [
						{
							id: "2023-01-01 Old Year",
							name: "2023-01-01 Old Year",
							group: "test",
							year: "2023",
						},
						{
							id: "2024-05-05 Test Session",
							name: "2024-05-05 Test Session",
							group: "test",
							year: "2024",
						},
					],
				});
			}
			return "";
		});

		await updateGroupProcess("test", false, false, false, false);

		expect(updateYearSync).toHaveBeenCalledWith(
			"test",
			"2023",
			expect.arrayContaining([
				expect.objectContaining({ id: "2023-01-01 Old Year" }),
			]),
		);
		expect(storage.deleteFile).toHaveBeenCalledWith(
			expect.stringContaining("/local/sync/test.json"),
		);
		expect(storage.deleteFile).toHaveBeenCalledWith(
			expect.stringContaining("/aws/sync/test.json.gz"),
		);
	});

	it("logs when migrating from merged file fails and still deletes local merged", async () => {
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
			return [];
		});
		storage.exists.mockImplementation(async (path) =>
			path.endsWith("/local/sync/test.json"),
		);
		storage.readFile.mockImplementation(async (path) => {
			if (path.endsWith("/local/sync/test.json")) return "{bad";
			return "";
		});

		await updateGroupProcess("test", false, false, false, false);

		expect(logger.error).toHaveBeenCalledWith(
			"Error migrating from merged file",
			expect.any(Error),
		);
		expect(storage.deleteFile).toHaveBeenCalledWith(
			expect.stringContaining("/local/sync/test.json"),
		);
	});

	it("falls back to per-file tags/duration/summary when zip metadata is empty", async () => {
		fetchSessionMetadata.mockResolvedValue({
			items: [
				file(
					"2024-05-05 Test Session.tags",
					"/aws/sessions/test/2024/2024-05-05 Test Session.tags",
				),
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
			],
			tags: {},
			durations: {},
			summaries: {},
			transcriptions: {},
		});
		storage.readFile.mockImplementation(async (path) => {
			if (path.endsWith(".tags"))
				return JSON.stringify({ tags: ["from-file"] });
			if (path.endsWith(".duration")) return JSON.stringify({ duration: 55 });
			if (path.endsWith(".md")) return "Summary body";
			return "";
		});

		await updateGroupProcess("test", true, true);

		expect(updateYearSync).toHaveBeenCalled();
		const [, , sessions] = updateYearSync.mock.calls[0];
		expect(sessions[0].tags).toEqual(["from-file"]);
		expect(sessions[0].duration).toBe(55);
		expect(sessions[0].summaryText || sessions[0].summary).toBeTruthy();
		expect(sessions[0].transcription).toBe(true);
	});

	it("warns when per-file metadata reads fail", async () => {
		fetchSessionMetadata.mockResolvedValue({
			items: [
				file(
					"2024-05-05 Test Session.tags",
					"/aws/sessions/test/2024/2024-05-05 Test Session.tags",
				),
				file(
					"2024-05-05 Test Session.duration",
					"/aws/sessions/test/2024/2024-05-05 Test Session.duration",
				),
				file(
					"2024-05-05 Test Session.md",
					"/aws/sessions/test/2024/2024-05-05 Test Session.md",
				),
			],
			tags: {},
			durations: {},
			summaries: {},
			transcriptions: {},
		});
		storage.readFile.mockRejectedValue(new Error("meta read fail"));

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

	it("logs when remote merged file deletion fails after split migration", async () => {
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
			return [];
		});
		storage.exists.mockImplementation(async (path) => {
			return (
				path.endsWith("/local/sync/test.json") ||
				path.endsWith("/aws/sync/test.json.gz")
			);
		});
		storage.readFile.mockImplementation(async (path) => {
			if (path.endsWith("/local/sync/test.json")) {
				return JSON.stringify({ sessions: [] });
			}
			return "";
		});
		storage.deleteFile.mockImplementation(async (path) => {
			if (String(path).includes("test.json.gz")) {
				throw new Error("remote delete fail");
			}
		});

		await updateGroupProcess("test", false, false, false, false);

		expect(logger.error).toHaveBeenCalledWith(
			expect.stringContaining("Error deleting remote merged file"),
			expect.any(Error),
		);
	});

	it("strips resolution suffixes from video session ids", async () => {
		getListing.mockImplementation(async (path) => {
			if (path === "wasabi/test") {
				return [{ name: "2024", type: "dir", path: "wasabi/test/2024" }];
			}
			if (path === "wasabi/test/2024") {
				return [
					file(
						"2024-05-05 Test Session_1920x1080.mp4",
						"wasabi/test/2024/2024-05-05 Test Session_1920x1080.mp4",
					),
				];
			}
			return [];
		});
		fetchSessionMetadata.mockResolvedValue({
			items: [],
			tags: { "2024-05-05 Test Session": ["hd"] },
			durations: {},
			summaries: {},
			transcriptions: {},
		});

		await updateGroupProcess("test", true, false);

		const [, , sessions] = updateYearSync.mock.calls[0];
		expect(sessions[0].id).toBe("2024-05-05 Test Session");
		expect(sessions[0].tags).toEqual(["hd"]);
	});

	it("matches metadata keys with normalized punctuation and casing", async () => {
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
			return [];
		});
		fetchSessionMetadata.mockResolvedValue({
			items: [],
			tags: { "20240505testsession": ["normalized"] },
			durations: { "2024-05-05 test session": 88 },
			summaries: {},
			transcriptions: {},
		});

		await updateGroupProcess("test", true, false);

		const [, , sessions] = updateYearSync.mock.calls[0];
		expect(sessions[0].tags).toEqual(["normalized"]);
		expect(sessions[0].duration).toBe(88);
	});

	it("ignores year-level metadata files when grouping session files", async () => {
		getListing.mockImplementation(async (path) => {
			if (path === "wasabi/test") {
				return [{ name: "2024", type: "dir", path: "wasabi/test/2024" }];
			}
			if (path === "wasabi/test/2024") {
				return [
					file("2024.tags", "wasabi/test/2024/2024.tags"),
					file("2024.duration", "wasabi/test/2024/2024.duration"),
					file(
						"2024-05-05 Test Session.mp4",
						"wasabi/test/2024/2024-05-05 Test Session.mp4",
					),
				];
			}
			return [];
		});
		fetchSessionMetadata.mockResolvedValue({
			items: [],
			tags: {},
			durations: {},
			summaries: {},
			transcriptions: {},
		});

		await updateGroupProcess("test", true, false);

		const [, , sessions] = updateYearSync.mock.calls[0];
		expect(sessions).toHaveLength(1);
		expect(sessions[0].id).toBe("2024-05-05 Test Session");
	});

	it("warns when group metadata listing fails but continues processing", async () => {
		getListing.mockImplementation(async (path) => {
			if (path === "/aws/sessions/test") {
				throw new Error("metadata listing down");
			}
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
			return [];
		});

		await updateGroupProcess("test", true, false);

		expect(logger.warn).toHaveBeenCalledWith(
			expect.stringContaining("Failed to list metadata for test"),
			expect.any(Error),
		);
		expect(updateYearSync).toHaveBeenCalled();
	});

	it("warns when year cache read fails and continues with remote metadata", async () => {
		storage.readFile.mockImplementation(async (path) => {
			if (path.includes(".group-update-cache/test/2024.json")) {
				throw new Error("cache read fail");
			}
			if (path.endsWith(".duration")) return "123";
			return "";
		});

		await updateGroupProcess("test", true, false);

		expect(logger.warn).toHaveBeenCalledWith(
			expect.stringContaining("Failed to read year cache"),
			expect.any(Error),
		);
		expect(updateYearSync).toHaveBeenCalled();
	});

	it("warns when year cache write fails after processing", async () => {
		storage.writeFile.mockRejectedValue(new Error("cache write fail"));

		await updateGroupProcess("test", true, false);

		expect(logger.warn).toHaveBeenCalledWith(
			expect.stringContaining("Failed to write year cache"),
			expect.any(Error),
		);
	});

	it("infers missing years from session ids when warning about omitted years", async () => {
		const oldSession = {
			id: "2022-01-01 Historical Session",
			name: "2022-01-01 Historical Session",
			group: "test",
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

		await updateGroupProcess("test", true, false, false, true);

		expect(addSyncLog).toHaveBeenCalledWith(
			expect.stringContaining("omitted locally stored years (2022)"),
			"warning",
		);
	});

	it("warns when legacy metadata folder listing fails", async () => {
		fetchSessionMetadata.mockRejectedValue(new Error("backend busy"));
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
			if (path === "/aws/sessions/test/2024") {
				throw new Error("metadata year listing fail");
			}
			return [];
		});
		loadTags.mockResolvedValue({});

		await updateGroupProcess("test", true, false);

		expect(logger.warn).toHaveBeenCalledWith(
			expect.stringContaining("Failed to list metadata folder"),
			expect.any(Error),
		);
	});

	it("reuses cached merged sessions when an unchanged year is skipped", async () => {
		const currentYear = String(new Date().getFullYear());
		const sessionId = `${currentYear}-03-03 Cached Merged`;
		const yearItems = [
			file(`${sessionId}.mp4`, `wasabi/test/${currentYear}/${sessionId}.mp4`),
		];
		const metadataFingerprint = [null, null, null, null];
		const yearFingerprint = getCombinedYearFingerprint(
			yearItems,
			metadataFingerprint,
		);
		const cachedSession = {
			id: sessionId,
			name: sessionId,
			group: "test",
			year: currentYear,
		};

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
			return [];
		});
		storage.exists.mockImplementation(async (path) =>
			path.endsWith("/local/sync/test.json"),
		);
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
			if (path.endsWith("/local/sync/test.json")) {
				return JSON.stringify({ sessions: [cachedSession] });
			}
			return "";
		});
		getFileInfo.mockResolvedValue({ hash: "abc", size: 10 });

		await updateGroupProcess("test", false, false, true, false);

		expect(addSyncLog).toHaveBeenCalledWith(
			expect.stringContaining("Skipped unchanged year"),
			"info",
		);
		expect(addSyncLog).toHaveBeenCalledWith(
			expect.stringContaining("Verified (no changes)"),
			"success",
		);
		expect(fetchSessionMetadata).not.toHaveBeenCalled();
		expect(writeCompressedFile).not.toHaveBeenCalled();
	});

	it("logs a full-year refresh when recentDays is set without local cache", async () => {
		const currentYear = String(new Date().getFullYear());
		const recentDate = new Date(Date.now() - 24 * 60 * 60 * 1000)
			.toISOString()
			.slice(0, 10);
		const recentId = `${recentDate} Recent Session`;

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
					file(`${recentId}.mp4`, `wasabi/test/${currentYear}/${recentId}.mp4`),
				];
			}
			return [];
		});
		storage.exists.mockResolvedValue(false);
		fetchSessionMetadata.mockResolvedValue({
			items: [],
			tags: { [recentId]: ["recent"] },
			durations: {},
			summaries: {},
			transcriptions: {},
		});

		await updateGroupProcess("test", false, true, false, false, null, 30);

		expect(addSyncLog).toHaveBeenCalledWith(
			expect.stringContaining("No local year cache; refreshing the full year"),
			"info",
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
		storage.exists.mockImplementation(async (path) =>
			path.endsWith("/local/sync/bundle.json"),
		);

		const sessions = await updateGroupProcess("test", true, false, false, true);
		expect(sessions).toHaveLength(1);

		jest.clearAllMocks();
		storage.exists.mockImplementation(async (path) =>
			path.endsWith("/local/sync/bundle.json"),
		);
		storage.readFile.mockImplementation(async (path) => {
			if (path.endsWith("/local/sync/bundle.json")) {
				return JSON.stringify({ sessions });
			}
			if (path.includes(".group-update-cache/test/2024.json")) {
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
			return "";
		});
		getListing.mockImplementation(async (path) => {
			if (path === "wasabi/test") {
				return [{ name: "2024", type: "dir", path: "wasabi/test/2024" }];
			}
			if (path === "wasabi/test/2024") {
				return yearItems;
			}
			return [];
		});

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
		storage.exists.mockImplementation(async (path) =>
			path.endsWith("/local/sync/test.json"),
		);
		storage.readFile.mockImplementation(async (path) => {
			if (path.endsWith("/local/sync/test.json")) {
				return JSON.stringify({ sessions: [] });
			}
			if (path.endsWith(".duration")) return "123";
			if (path.endsWith(".md")) return "Summary from DigitalOcean";
			return "";
		});

		await updateGroupProcess("test", true, false, true, false);
		const writtenPayload = writeCompressedFile.mock.calls.at(-1)[1];
		const writtenSessions =
			typeof writtenPayload === "string"
				? JSON.parse(writtenPayload).sessions
				: writtenPayload.sessions;

		jest.clearAllMocks();
		storage.exists.mockImplementation(async (path) =>
			path.endsWith("/local/sync/test.json"),
		);
		storage.readFile.mockImplementation(async (path) => {
			if (path.endsWith("/local/sync/test.json")) {
				return JSON.stringify({ sessions: writtenSessions });
			}
			if (path.includes(".group-update-cache/test/2024.json")) {
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
			if (path.endsWith(".duration")) return "123";
			if (path.endsWith(".md")) return "Summary from DigitalOcean";
			return "";
		});
		getListing.mockImplementation(async (path) => {
			if (path === "wasabi/test") {
				return [{ name: "2024", type: "dir", path: "wasabi/test/2024" }];
			}
			if (path === "wasabi/test/2024") {
				return yearItems;
			}
			return [];
		});

		await updateGroupProcess("test", true, false, true, false);

		expect(addSyncLog).toHaveBeenCalledWith(
			expect.stringContaining("Verified (no changes)"),
			"success",
		);
		expect(fetchSessionMetadata).not.toHaveBeenCalled();
		expect(writeCompressedFile).not.toHaveBeenCalled();
	});

	it("updates the local manifest after writing a merged group file", async () => {
		getFileInfo.mockResolvedValue({ hash: "merged-hash", size: 2048 });
		updateManifestEntry.mockResolvedValue();
		storage.readFile.mockImplementation(async (path) => {
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

	it("reads tags files that contain a raw JSON array", async () => {
		fetchSessionMetadata.mockResolvedValue({
			items: [
				file(
					"2024-05-05 Test Session.tags",
					"/aws/sessions/test/2024/2024-05-05 Test Session.tags",
				),
			],
			tags: {},
			durations: {},
			summaries: {},
			transcriptions: {},
		});
		storage.readFile.mockImplementation(async (path) => {
			if (path.endsWith(".tags")) return JSON.stringify(["raw-array-tag"]);
			return "";
		});

		await updateGroupProcess("test", true, true);

		const [, , sessions] = updateYearSync.mock.calls[0];
		expect(sessions[0].tags).toEqual(["raw-array-tag"]);
	});

	it("ignores non-session and metadata-only listing entries when checking for missing sessions", async () => {
		const currentYear = String(new Date().getFullYear());
		const sessionId = `${currentYear}-05-05 Cached Session`;
		const localYearPath = `/local/sync/test/${currentYear}.json`;
		const yearItems = [
			file("notes.txt", `wasabi/test/${currentYear}/notes.txt`),
			file(
				`${currentYear}-05-06 Metadata Only.txt`,
				`wasabi/test/${currentYear}/${currentYear}-05-06 Metadata Only.txt`,
			),
			file(
				`${currentYear}-05-07 .mp4`,
				`wasabi/test/${currentYear}/${currentYear}-05-07 .mp4`,
			),
			file(`${sessionId}.txt`, `wasabi/test/${currentYear}/${sessionId}.txt`),
			file(`${sessionId}.mp4`, `wasabi/test/${currentYear}/${sessionId}.mp4`),
		];
		const metadataFingerprint = [null, null, null, null];
		const yearFingerprint = getCombinedYearFingerprint(
			yearItems,
			metadataFingerprint,
		);

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
							id: sessionId,
							name: sessionId,
							group: "test",
							year: currentYear,
						},
					],
				});
			}
			return "";
		});

		await updateGroupProcess("test", false, false);

		expect(addSyncLog).toHaveBeenCalledWith(
			expect.stringContaining("Skipped unchanged year"),
			"info",
		);
		expect(updateYearSync).not.toHaveBeenCalled();
	});

	it("resolves metadata by normalized session name when id key is missing", async () => {
		const currentYear = String(new Date().getFullYear());
		const sessionId = `${currentYear}-05-05 Grace Session`;
		const _localYearPath = `/local/sync/test/${currentYear}.json`;
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
						`${sessionId}.mp4`,
						`wasabi/test/${currentYear}/${sessionId}.mp4`,
					),
				];
			}
			return [];
		});
		storage.exists.mockResolvedValue(false);
		storage.readFile.mockResolvedValue("");
		updateYearSync.mockResolvedValue({
			sessions: [
				{
					id: sessionId,
					name: sessionId,
					group: "test",
					year: currentYear,
					tags: ["Grace"],
				},
			],
		});

		await updateGroupProcess("test", true, false);

		expect(updateYearSync).toHaveBeenCalled();
	});

	it("resolves metadata by exact session id and session name keys", async () => {
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
						"2024-05-06 Name Key Session.mp4",
						"wasabi/test/2024/2024-05-06 Name Key Session.mp4",
					),
				];
			}
			return [];
		});
		fetchSessionMetadata.mockResolvedValue({
			items: [],
			tags: {
				"2024-05-05 Test Session": ["by-id"],
				"Name Key Session": ["by-name"],
			},
			durations: {
				"2024-05-05 Test Session": 11,
				"Name Key Session": 22,
			},
			summaries: {},
			transcriptions: {},
		});

		await updateGroupProcess("test", true, false);

		const [, , sessions] = updateYearSync.mock.calls[0];
		const byId = sessions.find((s) => s.id === "2024-05-05 Test Session");
		const byName = sessions.find((s) => s.id === "2024-05-06 Name Key Session");
		expect(byId.tags).toEqual(["by-id"]);
		expect(byId.duration).toBe(11);
		expect(byName.tags).toEqual(["by-name"]);
		expect(byName.duration).toBe(22);
	});

	it("processes digital-ocean-only image sessions without wasabi media", async () => {
		getListing.mockImplementation(async (path) => {
			if (path === "wasabi/test") {
				return [{ name: "2024", type: "dir", path: "wasabi/test/2024" }];
			}
			if (path === "wasabi/test/2024") {
				return [];
			}
			if (path === "/aws/sessions/test/2024") {
				return [
					file(
						"2024-05-07 Orphan Cover.png",
						"/aws/sessions/test/2024/2024-05-07 Orphan Cover.png",
					),
				];
			}
			return [];
		});
		fetchSessionMetadata.mockResolvedValue({
			items: [
				file(
					"2024-05-07 Orphan Cover.png",
					"/aws/sessions/test/2024/2024-05-07 Orphan Cover.png",
				),
			],
			tags: { "2024-05-07 Orphan Cover": ["do-only"] },
			durations: {},
			summaries: {},
			transcriptions: {},
		});

		await updateGroupProcess("test", true, false);

		const [, , sessions] = updateYearSync.mock.calls[0];
		expect(sessions).toHaveLength(1);
		expect(sessions[0].id).toBe("2024-05-07 Orphan Cover");
		expect(sessions[0].image).toBeTruthy();
		expect(sessions[0].tags).toEqual(["do-only"]);
	});

	it("recognizes year folders listed with stat.type instead of type", async () => {
		getListing.mockImplementation(async (path) => {
			if (path === "wasabi/test") {
				return [
					{
						name: "2024",
						path: "wasabi/test/2024",
						stat: { type: "dir" },
					},
				];
			}
			if (path === "wasabi/test/2024") {
				return [
					file(
						"2024-05-05 Test Session.mp4",
						"wasabi/test/2024/2024-05-05 Test Session.mp4",
					),
				];
			}
			return [];
		});

		await updateGroupProcess("test", true, false);

		expect(updateYearSync).toHaveBeenCalledWith(
			"test",
			"2024",
			expect.any(Array),
		);
	});

	it("loads metadata from local year files when year cache has no metadata payload", async () => {
		const currentYear = String(new Date().getFullYear());
		const sessionId = `${currentYear}-08-01 Cached Metadata Session`;
		const localYearPath = `/local/sync/test/${currentYear}.json`;
		const metadataFingerprint = [null, null, null, null];

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
						`${sessionId}.mp4`,
						`wasabi/test/${currentYear}/${sessionId}.mp4`,
					),
				];
			}
			return [];
		});
		storage.readFile.mockImplementation(async (path) => {
			if (path.includes(`.group-update-cache/test/${currentYear}.json`)) {
				return JSON.stringify({
					fingerprint: "stale",
					metadataFingerprint: JSON.stringify(metadataFingerprint),
				});
			}
			if (path === localYearPath) {
				return JSON.stringify({
					sessions: [
						{
							id: sessionId,
							name: sessionId,
							group: "test",
							year: currentYear,
							tags: ["local-meta"],
							duration: 444,
							summaryText: "From local year file",
							transcription: true,
						},
					],
				});
			}
			return "";
		});
		storage.exists.mockImplementation(async (path) => path === localYearPath);

		await updateGroupProcess("test", false, false);

		expect(fetchSessionMetadata).not.toHaveBeenCalled();
		const [, , sessions] = updateYearSync.mock.calls[0];
		expect(sessions[0].tags).toEqual(["local-meta"]);
		expect(sessions[0].duration).toBe(444);
		expect(sessions[0].summaryText).toBe("From local year file");
		expect(sessions[0].transcription).toBe(true);
	});

	it("treats cached year files with non-array sessions as empty", async () => {
		const currentYear = String(new Date().getFullYear());
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
						`${currentYear}-08-02 Fresh Session.mp4`,
						`wasabi/test/${currentYear}/${currentYear}-08-02 Fresh Session.mp4`,
					),
				];
			}
			return [];
		});
		storage.exists.mockImplementation(async (path) => path === localYearPath);
		storage.readFile.mockImplementation(async (path) => {
			if (path === localYearPath) {
				return JSON.stringify({ sessions: "not-an-array" });
			}
			return "";
		});

		await updateGroupProcess("test", false, false);

		expect(updateYearSync).toHaveBeenCalled();
	});

	it("records added sessions with metadata flags when updateYearSync reports changes", async () => {
		const newSession = {
			id: "2024-05-05 Test Session",
			name: "Test Session",
			group: "test",
			year: "2024",
			tags: ["fresh"],
			duration: 120,
			summaryText: "Updated summary",
			transcription: true,
			thumbnail: true,
			files: [{ name: "2024-05-05 Test Session.mp4" }],
		};
		updateYearSync.mockResolvedValue({
			counter: 1,
			newCount: 1,
			newSessions: [newSession],
		});

		await updateGroupProcess("test", true, false);

		const status = UpdateSessionsStore.getRawState().status.find(
			(item) => item.name === "test",
		);
		expect(status.addedCount).toBe(1);
		expect(status.newSessions[0].metadata).toEqual({
			hasTags: true,
			hasDuration: true,
			hasSummary: true,
			hasTranscription: true,
			hasThumbnail: true,
		});
		expect(SyncActiveStore.getRawState().needsSessionReload).toBe(true);
	});

	it("merges recent session updates using name-only cached session keys", async () => {
		const currentYear = String(new Date().getFullYear());
		const recentDate = new Date(Date.now() - 24 * 60 * 60 * 1000)
			.toISOString()
			.slice(0, 10);
		const oldId = `${currentYear}-01-01 Historical Session`;
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
					file(`${oldId}.mp4`, `wasabi/test/${currentYear}/${oldId}.mp4`),
					file(`${recentId}.mp4`, `wasabi/test/${currentYear}/${recentId}.mp4`),
				];
			}
			return [];
		});
		storage.exists.mockImplementation(async (path) => path === localYearPath);
		storage.readFile.mockImplementation(async (path) => {
			if (path === localYearPath) {
				return JSON.stringify({
					sessions: [
						{
							name: oldId,
							group: "test",
							year: currentYear,
							tags: ["preserve"],
						},
					],
				});
			}
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

		const [, , sessions] = updateYearSync.mock.calls[0];
		expect(sessions).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ name: oldId, tags: ["preserve"] }),
				expect.objectContaining({ id: recentId, tags: ["recent"] }),
			]),
		);
	});

	it("detects missing sessions from uncached audio files in the listing", async () => {
		const currentYear = String(new Date().getFullYear());
		const existingId = `${currentYear}-01-01 Existing Session`;
		const newAudioId = `${currentYear}-08-03 Audio Only Session`;
		const yearItems = [
			file(`${existingId}.mp4`, `wasabi/test/${currentYear}/${existingId}.mp4`),
			file(`${newAudioId}.m4a`, `wasabi/test/${currentYear}/${newAudioId}.m4a`),
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

		await updateGroupProcess("test", false, false);

		expect(addSyncLog).toHaveBeenCalledWith(
			expect.stringContaining("Refreshing 1 changed session(s)"),
			"info",
		);
		expect(updateYearSync).toHaveBeenCalled();
		const [, , sessions] = updateYearSync.mock.calls[0];
		expect(sessions.map((session) => session.id)).toEqual(
			expect.arrayContaining([existingId, newAudioId]),
		);
	});

	it("logs resolved metadata details for targeted sessions with summaries", async () => {
		const currentYear = String(new Date().getFullYear());
		const keepId = `${currentYear}-01-01 Keep Session`;
		const targetId = `${currentYear}-02-02 Target Session`;
		const localYearPath = `/local/sync/test/${currentYear}.json`;
		const longSummary = "A".repeat(120);

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
					file(`${keepId}.mp4`, `wasabi/test/${currentYear}/${keepId}.mp4`),
					file(`${targetId}.mp4`, `wasabi/test/${currentYear}/${targetId}.mp4`),
				];
			}
			return [];
		});
		storage.exists.mockImplementation(async (path) => path === localYearPath);
		storage.readFile.mockImplementation(async (path) => {
			if (path === localYearPath) {
				return JSON.stringify({
					sessions: [
						{
							id: keepId,
							name: keepId,
							group: "test",
							year: currentYear,
							tags: ["keep"],
						},
						{
							id: targetId,
							name: targetId,
							group: "test",
							year: currentYear,
							tags: ["stale"],
						},
					],
				});
			}
			return "";
		});
		fetchSessionMetadata.mockResolvedValue({
			items: [],
			tags: { [targetId]: ["fresh"] },
			durations: { [targetId]: 321 },
			summaries: { [targetId]: longSummary },
			transcriptions: { [targetId]: true },
		});

		await updateGroupProcess("test", false, true, false, false, targetId, null);

		expect(addSyncLog).toHaveBeenCalledWith(
			expect.stringContaining("Resolved summary from S3"),
			"info",
		);
		expect(addSyncLog).toHaveBeenCalledWith(
			expect.stringContaining("Targeted session metadata updated successfully"),
			"success",
		);
		const [, , sessions] = updateYearSync.mock.calls[0];
		expect(sessions.find((session) => session.id === keepId).tags).toEqual([
			"keep",
		]);
		expect(
			sessions.find((session) => session.id === targetId).summaryText,
		).toBe(longSummary);
	});

	it("records bundled new session metadata when sessions are added", async () => {
		storage.exists.mockImplementation(async (path) =>
			path.endsWith("/local/sync/bundle.json"),
		);
		storage.readFile.mockImplementation(async (path) => {
			if (path.endsWith("/local/sync/bundle.json")) {
				return JSON.stringify({ sessions: [] });
			}
			return "";
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
			return [];
		});
		fetchSessionMetadata.mockResolvedValue({
			items: [],
			tags: { "2024-05-05 Test Session": ["bundle"] },
			durations: { "2024-05-05 Test Session": 90 },
			summaries: { "2024-05-05 Test Session": "Bundled summary" },
			transcriptions: { "2024-05-05 Test Session": true },
		});

		await updateGroupProcess("test", true, false, false, true);

		const status = UpdateSessionsStore.getRawState().status.find(
			(item) => item.name === "test",
		);
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
		storage.exists.mockImplementation(async (path) =>
			path.endsWith("/local/sync/test.json"),
		);
		storage.readFile.mockImplementation(async (path) => {
			if (path.endsWith("/local/sync/test.json")) {
				return JSON.stringify({ sessions: [] });
			}
			if (path.endsWith(".duration")) return "123";
			if (path.endsWith(".md")) return "Summary from DigitalOcean";
			return "";
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
						"2024-05-05 Test Session.png",
						"/aws/sessions/test/2024/2024-05-05 Test Session.png",
					),
				];
			}
			return [];
		});
		fetchSessionMetadata.mockResolvedValue({
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
		});

		await updateGroupProcess("test", true, false, true, false);

		const status = UpdateSessionsStore.getRawState().status.find(
			(item) => item.name === "test",
		);
		expect(status.addedCount).toBe(1);
		expect(status.newSessions[0].metadata).toEqual({
			hasTags: true,
			hasDuration: true,
			hasSummary: true,
			hasTranscription: true,
			hasThumbnail: true,
		});
	});

	it("uses cached bundled sessions matched by explicit year field", async () => {
		const currentYear = String(new Date().getFullYear());
		const sessionId = `${currentYear}-03-03 Year Field Session`;
		const yearItems = [
			file(`${sessionId}.mp4`, `wasabi/test/${currentYear}/${sessionId}.mp4`),
		];
		const metadataFingerprint = [null, null, null, null];
		const yearFingerprint = getCombinedYearFingerprint(
			yearItems,
			metadataFingerprint,
		);
		const cachedSession = {
			id: sessionId,
			name: sessionId,
			group: "test",
			year: currentYear,
			tags: ["year-field"],
		};

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
			return [];
		});
		storage.exists.mockImplementation(async (path) =>
			path.endsWith("/local/sync/bundle.json"),
		);
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
			if (path.endsWith("/local/sync/bundle.json")) {
				return JSON.stringify({ sessions: [cachedSession] });
			}
			return "";
		});

		await updateGroupProcess("test", false, false, false, true);

		expect(addSyncLog).toHaveBeenCalledWith(
			expect.stringContaining("Skipped unchanged year"),
			"info",
		);
		expect(fetchSessionMetadata).not.toHaveBeenCalled();
	});

	it("continues when group metadata listing returns null", async () => {
		getListing.mockImplementation(async (path) => {
			if (path === "/aws/sessions/test") {
				return null;
			}
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
			return [];
		});

		await updateGroupProcess("test", true, false);

		expect(updateYearSync).toHaveBeenCalled();
	});

	it("records year processing errors that lack a message property", async () => {
		getListing.mockImplementation(async (path) => {
			if (path === "wasabi/test") {
				return [{ name: "2024", type: "dir", path: "wasabi/test/2024" }];
			}
			if (path === "wasabi/test/2024") {
				throw { toString: () => "year failure without message" };
			}
			return [];
		});

		await expect(
			updateGroupProcess("test", true, false, false, true),
		).resolves.toBeUndefined();

		const status = UpdateSessionsStore.getRawState().status.find(
			(item) => item.name === "test",
		);
		expect(status.errors).toEqual(
			expect.arrayContaining(["year failure without message"]),
		);
	});

	it("migrates merged sessions grouped by inferred year when year field is missing", async () => {
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
			return [];
		});
		storage.exists.mockImplementation(async (path) =>
			path.endsWith("/local/sync/test.json"),
		);
		storage.readFile.mockImplementation(async (path) => {
			if (path.endsWith("/local/sync/test.json")) {
				return JSON.stringify({
					sessions: [
						{
							id: "2023-06-01 Legacy Session",
							name: "2023-06-01 Legacy Session",
							group: "test",
						},
					],
				});
			}
			return "";
		});

		await updateGroupProcess("test", false, false, false, false);

		expect(updateYearSync).toHaveBeenCalledWith(
			"test",
			"undefined",
			expect.arrayContaining([
				expect.objectContaining({ id: "2023-06-01 Legacy Session" }),
			]),
		);
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
		storage.exists.mockImplementation(async (path) =>
			path.endsWith("/local/sync/bundle.json"),
		);
		storage.readFile.mockImplementation(async (path) => {
			if (path.endsWith("/local/sync/bundle.json")) {
				return JSON.stringify({ sessions });
			}
			return "";
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
				];
			}
			return [];
		});

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

	it("skips unchanged bundled years using sessions keyed by name only", async () => {
		const currentYear = String(new Date().getFullYear());
		const sessionId = `${currentYear}-04-04 Name Only Session`;
		const yearItems = [
			file(`${sessionId}.mp4`, `wasabi/test/${currentYear}/${sessionId}.mp4`),
		];
		const metadataFingerprint = [null, null, null, null];
		const yearFingerprint = getCombinedYearFingerprint(
			yearItems,
			metadataFingerprint,
		);

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
			return [];
		});
		storage.exists.mockImplementation(async (path) =>
			path.endsWith("/local/sync/bundle.json"),
		);
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
			if (path.endsWith("/local/sync/bundle.json")) {
				return JSON.stringify({
					sessions: [
						{
							name: sessionId,
							group: "test",
							year: currentYear,
						},
					],
				});
			}
			return "";
		});

		await updateGroupProcess("test", false, false, false, true);

		expect(addSyncLog).toHaveBeenCalledWith(
			expect.stringContaining("Skipped unchanged year"),
			"info",
		);
	});

	it("returns cached non-target sessions by name during targeted sync", async () => {
		const currentYear = String(new Date().getFullYear());
		const keepName = `${currentYear}-05-05 Keep By Name`;
		const targetId = `${currentYear}-05-06 Target Session`;
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
					file(`${keepName}.mp4`, `wasabi/test/${currentYear}/${keepName}.mp4`),
					file(`${targetId}.mp4`, `wasabi/test/${currentYear}/${targetId}.mp4`),
				];
			}
			return [];
		});
		storage.exists.mockImplementation(async (path) => path === localYearPath);
		storage.readFile.mockImplementation(async (path) => {
			if (path === localYearPath) {
				return JSON.stringify({
					sessions: [
						{
							name: keepName,
							group: "test",
							year: currentYear,
							tags: ["cached-by-name"],
						},
						{
							id: targetId,
							name: targetId,
							group: "test",
							year: currentYear,
							tags: ["stale"],
						},
					],
				});
			}
			return "";
		});
		fetchSessionMetadata.mockResolvedValue({
			items: [],
			tags: { [targetId]: ["fresh-target"] },
			durations: {},
			summaries: {},
			transcriptions: {},
		});

		await updateGroupProcess("test", false, true, false, false, targetId, null);

		const [, , sessions] = updateYearSync.mock.calls[0];
		expect(sessions.find((session) => session.name === keepName).tags).toEqual([
			"cached-by-name",
		]);
		expect(sessions.find((session) => session.id === targetId).tags).toEqual([
			"fresh-target",
		]);
	});

	it("loads cached metadata using name-only session keys from local year files", async () => {
		const currentYear = String(new Date().getFullYear());
		const sessionName = `${currentYear}-09-01 Name Metadata Session`;
		const localYearPath = `/local/sync/test/${currentYear}.json`;
		const metadataFingerprint = [null, null, null, null];

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
						`${sessionName}.mp4`,
						`wasabi/test/${currentYear}/${sessionName}.mp4`,
					),
				];
			}
			return [];
		});
		storage.exists.mockImplementation(async (path) => path === localYearPath);
		storage.readFile.mockImplementation(async (path) => {
			if (path.includes(`.group-update-cache/test/${currentYear}.json`)) {
				return JSON.stringify({
					fingerprint: "stale",
					metadataFingerprint: JSON.stringify(metadataFingerprint),
				});
			}
			if (path === localYearPath) {
				return JSON.stringify({
					sessions: [
						{
							name: sessionName,
							group: "test",
							year: currentYear,
							tags: ["name-key"],
							duration: 12,
						},
					],
				});
			}
			return "";
		});

		await updateGroupProcess("test", false, false);

		expect(fetchSessionMetadata).not.toHaveBeenCalled();
		const [, , sessions] = updateYearSync.mock.calls[0];
		expect(sessions[0].tags).toEqual(["name-key"]);
		expect(sessions[0].duration).toBe(12);
	});

	it("records bundled additions without thumbnails when no image is present", async () => {
		storage.exists.mockImplementation(async (path) =>
			path.endsWith("/local/sync/bundle.json"),
		);
		storage.readFile.mockImplementation(async (path) => {
			if (path.endsWith("/local/sync/bundle.json")) {
				return JSON.stringify({ sessions: [] });
			}
			return "";
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
				];
			}
			return [];
		});
		fetchSessionMetadata.mockResolvedValue({
			items: [],
			tags: { "2024-05-05 Test Session": ["bundle"] },
			durations: { "2024-05-05 Test Session": 1 },
			summaries: {},
			transcriptions: {},
		});

		await updateGroupProcess("test", true, false, false, true);

		const status = UpdateSessionsStore.getRawState().status.find(
			(item) => item.name === "test",
		);
		expect(status.newSessions[0].metadata.hasThumbnail).toBe(false);
	});

	it("records merged additions without thumbnails when no image is present", async () => {
		storage.exists.mockImplementation(async (path) =>
			path.endsWith("/local/sync/test.json"),
		);
		storage.readFile.mockImplementation(async (path) => {
			if (path.endsWith("/local/sync/test.json")) {
				return JSON.stringify({ sessions: [] });
			}
			return "";
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
				];
			}
			return [];
		});
		fetchSessionMetadata.mockResolvedValue({
			items: [],
			tags: { "2024-05-05 Test Session": ["merged"] },
			durations: { "2024-05-05 Test Session": 1 },
			summaries: {},
			transcriptions: {},
		});

		await updateGroupProcess("test", true, false, true, false);

		const status = UpdateSessionsStore.getRawState().status.find(
			(item) => item.name === "test",
		);
		expect(status.newSessions[0].metadata.hasThumbnail).toBe(false);
	});

	it("aborts split updates when the root listing throws without a message", async () => {
		getListing.mockImplementation(async () => {
			throw { toString: () => "listing failure without message" };
		});

		await expect(updateGroupProcess("test", true)).resolves.toBeUndefined();

		const status = UpdateSessionsStore.getRawState().status.find(
			(item) => item.name === "test",
		);
		expect(status.errors).toEqual(
			expect.arrayContaining(["listing failure without message"]),
		);
	});

	it("finishes with completion logs when split updates add sessions", async () => {
		updateYearSync.mockResolvedValue({
			counter: 2,
			newCount: 2,
			newSessions: [
				{ id: "2024-05-05 Test Session", files: [] },
				{ id: "2024-05-06 Metadata Only", files: [] },
			],
		});

		await updateGroupProcess("test", true, false);

		const status = UpdateSessionsStore.getRawState().status.find(
			(item) => item.name === "test",
		);
		expect(status.progress).toBe(1);
		expect(status.year).toBeNull();
		expect(addSyncLog).toHaveBeenCalledWith(
			expect.stringMatching(/Updated \(1 sessions, 2 updated, last:/),
			"success",
		);
	});

	it("reads bundled group files that exist but omit a sessions array", async () => {
		storage.exists.mockImplementation(async (path) =>
			path.endsWith("/local/sync/bundle.json"),
		);
		storage.readFile.mockImplementation(async (path) => {
			if (path.endsWith("/local/sync/bundle.json")) {
				return JSON.stringify({ version: 1 });
			}
			return "";
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
				];
			}
			return [];
		});

		const sessions = await updateGroupProcess("test", true, false, false, true);

		expect(sessions).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ id: "2024-05-05 Test Session" }),
			]),
		);
	});

	it("reads merged group files that exist but omit a sessions array", async () => {
		storage.exists.mockImplementation(async (path) =>
			path.endsWith("/local/sync/test.json"),
		);
		storage.readFile.mockImplementation(async (path) => {
			if (path.endsWith("/local/sync/test.json")) {
				return JSON.stringify({ version: 1 });
			}
			return "";
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
				];
			}
			return [];
		});

		await updateGroupProcess("test", true, false, true, false);

		expect(writeCompressedFile).toHaveBeenCalled();
	});
});
