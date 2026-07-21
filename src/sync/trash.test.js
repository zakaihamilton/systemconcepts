import storage from "@util/storage/storage";
import {
	createSyncTrashId,
	getTrashPath,
	moveFileToTrash,
	moveFolderToTrash,
} from "./trash";

jest.mock("@util/storage/storage", () => ({
	__esModule: true,
	default: {
		createFolderPath: jest.fn(),
		moveFile: jest.fn(),
		moveFolder: jest.fn(),
	},
}));

describe("createSyncTrashId", () => {
	it("generates unique, non-empty ids", () => {
		const a = createSyncTrashId();
		const b = createSyncTrashId();
		expect(a).not.toBe(b);
		expect(a.length).toBeGreaterThan(0);
	});
});

describe("getTrashPath", () => {
	it("builds a path nested under .sync-trash/<syncId>", () => {
		expect(getTrashPath("local/sync", "sync-1", "/alpha.json")).toBe(
			"/local/sync/.sync-trash/sync-1/alpha.json",
		);
	});
});

describe("moveFileToTrash", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("moves the file into the trash folder and reports success", async () => {
		storage.createFolderPath.mockResolvedValue(undefined);
		storage.moveFile.mockResolvedValue(undefined);

		const result = await moveFileToTrash("local/sync", "sync-1", "/a.json");

		expect(storage.createFolderPath).toHaveBeenCalledWith(
			"/local/sync/.sync-trash/sync-1/a.json",
		);
		expect(storage.moveFile).toHaveBeenCalledWith(
			"/local/sync/a.json",
			"/local/sync/.sync-trash/sync-1/a.json",
		);
		expect(result).toEqual({
			moved: true,
			missing: false,
			sourcePath: "/local/sync/a.json",
			trashPath: "/local/sync/.sync-trash/sync-1/a.json",
		});
	});

	it("reports a missing (non-fatal) file instead of throwing on a 404", async () => {
		storage.createFolderPath.mockResolvedValue(undefined);
		storage.moveFile.mockRejectedValue(new Error("Failed to fetch file: 404"));

		const result = await moveFileToTrash("local/sync", "sync-1", "/a.json");

		expect(result.moved).toBe(false);
		expect(result.missing).toBe(true);
	});

	it("propagates unexpected (non-missing) errors", async () => {
		storage.createFolderPath.mockResolvedValue(undefined);
		storage.moveFile.mockRejectedValue(new Error("permission denied"));

		await expect(
			moveFileToTrash("local/sync", "sync-1", "/a.json"),
		).rejects.toThrow("permission denied");
	});
});

describe("moveFolderToTrash", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("moves the folder into the trash folder and reports success", async () => {
		storage.createFolderPath.mockResolvedValue(undefined);
		storage.moveFolder.mockResolvedValue(undefined);

		const result = await moveFolderToTrash("local/sync", "sync-1", "/adir");

		expect(storage.createFolderPath).toHaveBeenCalledWith(
			"/local/sync/.sync-trash/sync-1/adir",
			true,
		);
		expect(result.moved).toBe(true);
	});

	it("reports a missing folder instead of throwing on ENOENT", async () => {
		storage.createFolderPath.mockResolvedValue(undefined);
		storage.moveFolder.mockRejectedValue(
			Object.assign(new Error("not found"), { code: "ENOENT" }),
		);

		const result = await moveFolderToTrash("local/sync", "sync-1", "/adir");

		expect(result).toEqual({
			moved: false,
			missing: true,
			sourcePath: "/local/sync/adir",
			trashPath: "/local/sync/.sync-trash/sync-1/adir",
		});
	});

	it("propagates unexpected errors", async () => {
		storage.createFolderPath.mockResolvedValue(undefined);
		storage.moveFolder.mockRejectedValue(new Error("disk exploded"));

		await expect(
			moveFolderToTrash("local/sync", "sync-1", "/adir"),
		).rejects.toThrow("disk exploded");
	});
});
