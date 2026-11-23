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
import { file, setupUpdateGroupTest } from "./updateGroupTestSetup";
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


describe("updateGroupProcess persistence and migration", () => {
	beforeEach(() => {
		setupUpdateGroupTest();
	});

	it("preserves older bundled sessions when a full update omits their year", async () => {
		const oldSession = {
			id: "2022-01-01 Historical Session",
			name: "2022-01-01 Historical Session",
			group: "test",
			year: "2022",
		};
		asMock(storage.exists).mockImplementation(async (path: any) =>
			path.endsWith("/local/sync/bundle.json"),
		);
		asMock(storage.readFile).mockImplementation(async (path: any) => {
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
		asMock(storage.exists).mockImplementation(async (path: any) =>
			path.endsWith("/local/sync/test.json"),
		);
		asMock(storage.readFile).mockImplementation(async (path: any) => {
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
		const [, mergedJson] = asMock(writeCompressedFile).mock.calls[0];
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
		asMock(storage.exists).mockImplementation(async (path: any) =>
			path.endsWith("/local/sync/bundle.json"),
		);
		asMock(storage.readFile).mockImplementation(async (path: any) => {
			if (path.endsWith("/local/sync/bundle.json")) {
				return JSON.stringify({ sessions: [oldSession] });
			}
			return "";
		});
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
		asMock(storage.exists).mockImplementation(async (path: any) =>
			path.endsWith("/local/sync/test.json"),
		);
		asMock(storage.readFile).mockImplementation(async (path: any) => {
			if (path.endsWith("/local/sync/test.json")) return "{bad";
			return "";
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
		asMock(storage.exists).mockImplementation(async (path: any) =>
			path.endsWith("/local/sync/bundle.json"),
		);
		asMock(storage.readFile).mockImplementation(async (path: any) => {
			if (path.endsWith("/local/sync/bundle.json")) return "{bad";
			return "";
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

	it("infers missing years from session ids when warning about omitted years", async () => {
		const oldSession = {
			id: "2022-01-01 Historical Session",
			name: "2022-01-01 Historical Session",
			group: "test",
		};
		asMock(storage.exists).mockImplementation(async (path: any) =>
			path.endsWith("/local/sync/bundle.json"),
		);
		asMock(storage.readFile).mockImplementation(async (path: any) => {
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
		asMock(storage.exists).mockImplementation(async (path: any) =>
			path.endsWith("/local/sync/bundle.json"),
		);
		asMock(storage.readFile).mockImplementation(async (path: any) => {
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
		asMock(getListing).mockImplementation(async (path: any) => {
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
		asMock(storage.exists).mockImplementation(async (path: any) =>
			path.endsWith("/local/sync/test.json"),
		);
		asMock(storage.readFile).mockImplementation(async (path: any) => {
			if (path.endsWith("/local/sync/test.json")) {
				return JSON.stringify({ sessions: [] });
			}
			if (path.endsWith(".duration")) return "123";
			if (path.endsWith(".md")) return "Summary from DigitalOcean";
			return "";
		});

		await updateGroupProcess("test", true, false, true, false);
		const writtenPayload = asMock(writeCompressedFile).mock.calls.at(-1)[1];
		const writtenSessions =
			typeof writtenPayload === "string"
				? JSON.parse(writtenPayload).sessions
				: writtenPayload.sessions;

		jest.clearAllMocks();
		asMock(storage.exists).mockImplementation(async (path: any) =>
			path.endsWith("/local/sync/test.json"),
		);
		asMock(storage.readFile).mockImplementation(async (path: any) => {
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
		asMock(getListing).mockImplementation(async (path: any) => {
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
		asMock(storage.exists).mockImplementation(async (path: any) =>
			path.endsWith("/local/sync/bundle.json"),
		);
		asMock(storage.readFile).mockImplementation(async (path: any) => {
			if (path.endsWith("/local/sync/bundle.json")) {
				return JSON.stringify({ sessions: [] });
			}
			return "";
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
			return [];
		});
		asMock(fetchSessionMetadata).mockResolvedValue({
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
		asMock(storage.exists).mockImplementation(async (path: any) =>
			path.endsWith("/local/sync/test.json"),
		);
		asMock(storage.readFile).mockImplementation(async (path: any) => {
			if (path.endsWith("/local/sync/test.json")) {
				return JSON.stringify({ sessions: [] });
			}
			if (path.endsWith(".duration")) return "123";
			if (path.endsWith(".md")) return "Summary from DigitalOcean";
			return "";
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
						"2024-05-05 Test Session.png",
						"/aws/sessions/test/2024/2024-05-05 Test Session.png",
					),
				];
			}
			return [];
		});
		asMock(fetchSessionMetadata).mockResolvedValue({
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

	it("forces bundled updates even when session payloads are unchanged", async () => {
		const sessions = [
			{
				id: "2024-05-05 Test Session",
				name: "Test Session",
				group: "test",
				year: "2024",
			},
		];
		asMock(storage.exists).mockImplementation(async (path: any) =>
			path.endsWith("/local/sync/bundle.json"),
		);
		asMock(storage.readFile).mockImplementation(async (path: any) => {
			if (path.endsWith("/local/sync/bundle.json")) {
				return JSON.stringify({ sessions });
			}
			return "";
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

	it("records bundled additions without thumbnails when no image is present", async () => {
		asMock(storage.exists).mockImplementation(async (path: any) =>
			path.endsWith("/local/sync/bundle.json"),
		);
		asMock(storage.readFile).mockImplementation(async (path: any) => {
			if (path.endsWith("/local/sync/bundle.json")) {
				return JSON.stringify({ sessions: [] });
			}
			return "";
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
				];
			}
			return [];
		});
		asMock(fetchSessionMetadata).mockResolvedValue({
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
		asMock(storage.exists).mockImplementation(async (path: any) =>
			path.endsWith("/local/sync/test.json"),
		);
		asMock(storage.readFile).mockImplementation(async (path: any) => {
			if (path.endsWith("/local/sync/test.json")) {
				return JSON.stringify({ sessions: [] });
			}
			return "";
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
				];
			}
			return [];
		});
		asMock(fetchSessionMetadata).mockResolvedValue({
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

	it("reads bundled group files that exist but omit a sessions array", async () => {
		asMock(storage.exists).mockImplementation(async (path: any) =>
			path.endsWith("/local/sync/bundle.json"),
		);
		asMock(storage.readFile).mockImplementation(async (path: any) => {
			if (path.endsWith("/local/sync/bundle.json")) {
				return JSON.stringify({ version: 1 });
			}
			return "";
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
		asMock(storage.exists).mockImplementation(async (path: any) =>
			path.endsWith("/local/sync/test.json"),
		);
		asMock(storage.readFile).mockImplementation(async (path: any) => {
			if (path.endsWith("/local/sync/test.json")) {
				return JSON.stringify({ version: 1 });
			}
			return "";
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
				];
			}
			return [];
		});

		await updateGroupProcess("test", true, false, true, false);

		expect(writeCompressedFile).toHaveBeenCalled();
	});
});
