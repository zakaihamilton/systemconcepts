import { writeCompressedFile } from "@sync/bundle";
import { getFileInfo } from "@sync/hash";
import { updateManifestEntry } from "@sync/manifest";
import { addSyncLog } from "@sync/sync";
import { SyncActiveStore, UpdateSessionsStore } from "@sync/syncState";
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

function file(name: any, path: any) {
	return { id: path, name, type: "file" as const, path };
}

describe("updateGroupProcess metadata resolution", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		UpdateSessionsStore.update((s) => {
			s.status = [];
		});
		SyncActiveStore.update((s) => {
			s.needsSessionReload = false;
		});

		asMock(storage.exists).mockResolvedValue(false);
		asMock(storage.readFile).mockImplementation(async (path: any) => {
			if (path.endsWith(".duration")) return "123";
			if (path.endsWith(".md")) return "Summary from DigitalOcean";
			if (path.endsWith(".tags")) return JSON.stringify(["ai", "sync"]);
			return "";
		});
		asMock(loadTags).mockResolvedValue({});
		asMock(loadDurations).mockResolvedValue({});
		asMock(loadSummaries).mockResolvedValue({});
		asMock(loadTranscriptions).mockResolvedValue({});
		asMock(fetchSessionMetadata).mockResolvedValue({
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

		asMock(getListing).mockImplementation(async (path: any) => {
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

		asMock(updateYearSync).mockResolvedValue({
			counter: 0,
			newCount: 0,
			newSessions: [],
		});
		void writeCompressedFile;
		void getFileInfo;
		void updateManifestEntry;
		void addSyncLog;
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
		asMock(fetchSessionMetadata).mockResolvedValue({
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
		asMock(fetchSessionMetadata).mockResolvedValue({
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
		asMock(getListing).mockImplementation(async (path: any) => {
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
		asMock(fetchSessionMetadata).mockResolvedValue({
			items: [],
			tags: { "2024-05-05 Test Session": ["hd"] },
			durations: {},
			summaries: {},
			transcriptions: {},
		});

		await updateGroupProcess("test", true, false);

		const [, , sessions] = asMock(updateYearSync).mock.calls[0];
		expect(sessions[0].id).toBe("2024-05-05 Test Session");
		expect(sessions[0].tags).toEqual(["hd"]);
	});

	it("matches metadata keys with normalized punctuation and casing", async () => {
		asMock(getListing).mockImplementation(async (path: any) => {
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
		asMock(fetchSessionMetadata).mockResolvedValue({
			items: [],
			tags: { "20240505testsession": ["normalized"] },
			durations: { "2024-05-05 test session": 88 },
			summaries: {},
			transcriptions: {},
		});

		await updateGroupProcess("test", true, false);

		const [, , sessions] = asMock(updateYearSync).mock.calls[0];
		expect(sessions[0].tags).toEqual(["normalized"]);
		expect(sessions[0].duration).toBe(88);
	});

	it("ignores year-level metadata files when grouping session files", async () => {
		asMock(getListing).mockImplementation(async (path: any) => {
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
		asMock(fetchSessionMetadata).mockResolvedValue({
			items: [],
			tags: {},
			durations: {},
			summaries: {},
			transcriptions: {},
		});

		await updateGroupProcess("test", true, false);

		const [, , sessions] = asMock(updateYearSync).mock.calls[0];
		expect(sessions).toHaveLength(1);
		expect(sessions[0].id).toBe("2024-05-05 Test Session");
	});

	it("warns when group metadata listing fails but continues processing", async () => {
		asMock(getListing).mockImplementation(async (path: any) => {
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

	it("warns when legacy metadata folder listing fails", async () => {
		asMock(fetchSessionMetadata).mockRejectedValue(new Error("backend busy"));
		asMock(getListing).mockImplementation(async (path: any) => {
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
		asMock(loadTags).mockResolvedValue({});

		await updateGroupProcess("test", true, false);

		expect(logger.warn).toHaveBeenCalledWith(
			expect.stringContaining("Failed to list metadata folder"),
			expect.any(Error),
		);
	});

	it("reads tags files that contain a raw JSON array", async () => {
		asMock(fetchSessionMetadata).mockResolvedValue({
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
		const localYearPath = `/local/sync/test/${currentYear}.json`;
		const metadataFingerprint = [null, null, null, null];

		asMock(getListing).mockImplementation(async (path: any) => {
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
		asMock(storage.readFile).mockImplementation(async (path: any) => {
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
		asMock(storage.exists).mockImplementation(
			async (path: any) => path === localYearPath,
		);

		await updateGroupProcess("test", false, false);

		expect(fetchSessionMetadata).not.toHaveBeenCalled();
		const [, , sessions] = asMock(updateYearSync).mock.calls[0];
		expect(sessions[0].tags).toEqual(["local-meta"]);
		expect(sessions[0].duration).toBe(444);
		expect(sessions[0].summaryText).toBe("From local year file");
		expect(sessions[0].transcription).toBe(true);
	});

	it("loads cached metadata using name-only session keys from local year files", async () => {
		const currentYear = String(new Date().getFullYear());
		const sessionName = `${currentYear}-09-01 Name Metadata Session`;
		const localYearPath = `/local/sync/test/${currentYear}.json`;
		const metadataFingerprint = [null, null, null, null];

		asMock(getListing).mockImplementation(async (path: any) => {
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
		asMock(storage.exists).mockImplementation(
			async (path: any) => path === localYearPath,
		);
		asMock(storage.readFile).mockImplementation(async (path: any) => {
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
		const [, , sessions] = asMock(updateYearSync).mock.calls[0];
		expect(sessions[0].tags).toEqual(["name-key"]);
		expect(sessions[0].duration).toBe(12);
	});
});
