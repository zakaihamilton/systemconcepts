import { addSyncLog } from "@sync/sync";
import { logger } from "@util/api/logger";
import storage from "@util/storage/storage";
import { cleanupBundledGroup, cleanupMergedGroup } from "./cleanup";

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
	deleteFile: jest.fn(),
	deleteFolder: jest.fn(),
	exists: jest.fn(),
	getListing: jest.fn(),
	readFile: jest.fn(),
	writeFile: jest.fn(),
}));

describe("cleanupBundledGroup", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("deletes local year files, the empty folder, and the legacy merged file", async () => {
		storage.exists.mockImplementation(async (path) => {
			return (
				path === "/local/sync/test" ||
				path === "/local/sync/files.json" ||
				path === "/local/sync/test.json"
			);
		});
		storage.getListing.mockResolvedValue([
			{ name: "2023.json" },
			{ name: "2024.json" },
			{ name: "notes.txt" },
		]);
		storage.readFile.mockResolvedValue(
			JSON.stringify([
				{ path: "/test/2023.json" },
				{ path: "/test/2024.json" },
				{ path: "/other/2024.json" },
			]),
		);

		await cleanupBundledGroup("test");

		expect(storage.deleteFile).toHaveBeenCalledWith(
			"/local/sync/test/2023.json",
		);
		expect(storage.deleteFile).toHaveBeenCalledWith(
			"/local/sync/test/2024.json",
		);
		expect(storage.deleteFile).not.toHaveBeenCalledWith(
			expect.stringContaining("notes.txt"),
		);
		expect(storage.deleteFolder).toHaveBeenCalledWith("/local/sync/test");
		expect(storage.writeFile).toHaveBeenCalledWith(
			"/local/sync/files.json",
			JSON.stringify([{ path: "/other/2024.json" }], null, 4),
		);
		expect(storage.deleteFile).toHaveBeenCalledWith("/local/sync/test.json");
	});

	it("does nothing when there are no local year files or manifest entries", async () => {
		storage.exists.mockResolvedValue(false);

		await cleanupBundledGroup("empty-group");

		expect(storage.getListing).not.toHaveBeenCalled();
		expect(storage.deleteFolder).not.toHaveBeenCalled();
		expect(storage.writeFile).not.toHaveBeenCalled();
		expect(storage.deleteFile).not.toHaveBeenCalled();
	});

	it("does not rewrite the manifest when no entries match the group", async () => {
		storage.exists.mockImplementation(
			async (path) => path === "/local/sync/files.json",
		);
		storage.readFile.mockResolvedValue(
			JSON.stringify([{ path: "/other/2024.json" }]),
		);

		await cleanupBundledGroup("test");

		expect(storage.writeFile).not.toHaveBeenCalled();
	});

	it("logs an error and continues when deleting split files fails", async () => {
		storage.exists.mockImplementation(
			async (path) => path === "/local/sync/test",
		);
		storage.getListing.mockRejectedValue(new Error("listing failed"));

		await cleanupBundledGroup("test");

		expect(logger.error).toHaveBeenCalledWith(
			expect.stringContaining("Error deleting split files"),
			expect.any(Error),
		);
		expect(addSyncLog).toHaveBeenCalledWith(
			expect.stringContaining("Could not delete old split files"),
			"warning",
		);
	});

	it("logs an error when updating the manifest fails", async () => {
		storage.exists.mockImplementation(
			async (path) => path === "/local/sync/files.json",
		);
		storage.readFile.mockRejectedValue(new Error("manifest read failed"));

		await cleanupBundledGroup("test");

		expect(logger.error).toHaveBeenCalledWith(
			expect.stringContaining("Error updating manifest"),
			expect.any(Error),
		);
	});
});

describe("cleanupMergedGroup", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("deletes local year files and the empty folder", async () => {
		storage.exists.mockImplementation(
			async (path) => path === "/local/sync/test",
		);
		storage.getListing.mockResolvedValue([
			{ name: "2023.json" },
			{ name: "ignore.me" },
		]);

		await cleanupMergedGroup("test");

		expect(storage.deleteFile).toHaveBeenCalledWith(
			"/local/sync/test/2023.json",
		);
		expect(storage.deleteFolder).toHaveBeenCalledWith("/local/sync/test");
	});

	it("does nothing when the years folder does not exist", async () => {
		storage.exists.mockResolvedValue(false);

		await cleanupMergedGroup("test");

		expect(storage.getListing).not.toHaveBeenCalled();
		expect(storage.deleteFolder).not.toHaveBeenCalled();
	});

	it("logs an error and adds a sync log warning when deletion fails", async () => {
		storage.exists.mockImplementation(
			async (path) => path === "/local/sync/test",
		);
		storage.getListing.mockRejectedValue(new Error("listing failed"));

		await cleanupMergedGroup("test");

		expect(logger.error).toHaveBeenCalledWith(
			expect.stringContaining("Error deleting split files"),
			expect.any(Error),
		);
		expect(addSyncLog).toHaveBeenCalledWith(
			expect.stringContaining("Could not delete old split files"),
			"warning",
		);
	});

	it("does not delete files with a non-json extension in the years folder", async () => {
		storage.exists.mockImplementation(
			async (path) => path === "/local/sync/test",
		);
		storage.getListing.mockResolvedValue([{ name: "readme.md" }]);

		await cleanupMergedGroup("test");

		expect(storage.deleteFile).not.toHaveBeenCalled();
		expect(storage.deleteFolder).toHaveBeenCalledWith("/local/sync/test");
	});
});
