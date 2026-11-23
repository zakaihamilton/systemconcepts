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
import { file } from "./updateGroupTestSetup";
import { getListing, updateYearSync } from "./utils";

jest.mock("@util/storage/storage", () =>
	require("./updateGroupMockFactories").storageMockFactory(),
);

describe("updateGroupProcess merged-to-split migration", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		UpdateSessionsStore.update((s) => {
			s.status = [];
		});
		SyncActiveStore.update((s) => {
			s.needsSessionReload = false;
		});

		asMock(storage.exists).mockResolvedValue(false);
		asMock(storage.readFile).mockResolvedValue("");
		asMock(loadTags).mockResolvedValue({});
		asMock(loadDurations).mockResolvedValue({});
		asMock(loadSummaries).mockResolvedValue({});
		asMock(loadTranscriptions).mockResolvedValue({});
		asMock(fetchSessionMetadata).mockResolvedValue({
			items: [],
			tags: {},
			durations: {},
			summaries: {},
			transcriptions: {},
		});
		asMock(getListing).mockResolvedValue([]);
		asMock(updateYearSync).mockResolvedValue({
			counter: 0,
			newCount: 0,
			newSessions: [],
		});
	});

	it("migrates leftover years from a merged file when switching to split", async () => {
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
		asMock(storage.exists).mockImplementation(async (path: any) => {
			return (
				path.endsWith("/local/sync/test.json") ||
				path.endsWith("/aws/sync/test.json.gz")
			);
		});
		asMock(storage.readFile).mockImplementation(async (path: any) => {
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
		asMock(storage.exists).mockImplementation(async (path: any) =>
			path.endsWith("/local/sync/test.json"),
		);
		asMock(storage.readFile).mockImplementation(async (path: any) => {
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

	it("logs when remote merged file deletion fails after split migration", async () => {
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
		asMock(storage.exists).mockImplementation(async (path: any) => {
			return (
				path.endsWith("/local/sync/test.json") ||
				path.endsWith("/aws/sync/test.json.gz")
			);
		});
		asMock(storage.readFile).mockImplementation(async (path: any) => {
			if (path.endsWith("/local/sync/test.json")) {
				return JSON.stringify({ sessions: [] });
			}
			return "";
		});
		asMock(storage.deleteFile).mockImplementation(async (path: any) => {
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

	it("migrates merged sessions grouped by inferred year when year field is missing", async () => {
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
		asMock(storage.exists).mockImplementation(async (path: any) =>
			path.endsWith("/local/sync/test.json"),
		);
		asMock(storage.readFile).mockImplementation(async (path: any) => {
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
});
