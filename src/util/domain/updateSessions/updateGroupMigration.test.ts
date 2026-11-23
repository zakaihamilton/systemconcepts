import "./updateGroupTestSetup";
import { logger } from "@util/api/logger";
import storage from "@util/storage/storage";
import { updateGroupProcess } from "./updateGroup";
import {
	emptyYearMetadata,
	file,
	mockYearListing,
	setupUpdateGroupTest,
} from "./updateGroupTestSetup";
import { updateYearSync } from "./utils";

function mockMergedFile(
	options: {
		sessions?: unknown[];
		remoteExists?: boolean;
		malformed?: boolean;
	} = {},
) {
	mockYearListing("2024", [
		file(
			"2024-05-05 Test Session.mp4",
			"wasabi/test/2024/2024-05-05 Test Session.mp4",
		),
	]);
	asMock(storage.exists).mockImplementation(async (path: string) => {
		return (
			path.endsWith("/local/sync/test.json") ||
			Boolean(options.remoteExists && path.endsWith("/aws/sync/test.json.gz"))
		);
	});
	asMock(storage.readFile).mockImplementation(async (path: string) => {
		if (!path.endsWith("/local/sync/test.json")) return "";
		if (options.malformed) return "{bad";
		return JSON.stringify({ sessions: options.sessions ?? [] });
	});
}

describe("updateGroupProcess merged-to-split migration", () => {
	beforeEach(() => {
		setupUpdateGroupTest({
			readFile: async () => "",
			sessionMetadata: emptyYearMetadata(),
			listing: async () => [],
		});
	});

	it("migrates leftover years from a merged file when switching to split", async () => {
		mockMergedFile({
			remoteExists: true,
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
		mockMergedFile({ malformed: true });

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
		mockMergedFile({ remoteExists: true, sessions: [] });
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
		mockMergedFile({
			sessions: [
				{
					id: "2023-06-01 Legacy Session",
					name: "2023-06-01 Legacy Session",
					group: "test",
				},
			],
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
