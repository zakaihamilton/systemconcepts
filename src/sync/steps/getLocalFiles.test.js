import storage from "@util/storage/storage";
import { getLocalFiles } from "./getLocalFiles";

jest.mock("@util/storage/storage", () => ({
	__esModule: true,
	default: { getRecursiveList: jest.fn() },
}));
jest.mock("../logs", () => ({ addSyncLog: jest.fn() }));

describe("getLocalFiles", () => {
	it("uses strict discovery and propagates listing failures", async () => {
		storage.getRecursiveList.mockRejectedValue(new Error("listing failed"));

		await expect(getLocalFiles("local/sync")).rejects.toThrow("listing failed");
		expect(storage.getRecursiveList).toHaveBeenCalledWith("local/sync", {
			strict: true,
		});
	});

	it("excludes recoverable trash from sync discovery", async () => {
		storage.getRecursiveList.mockResolvedValue([
			{
				type: "file",
				name: "old.json",
				path: "/local/sync/.sync-trash/run/old.json",
			},
			{
				type: "file",
				name: "active.json",
				path: "/local/sync/active.json",
			},
		]);

		await expect(getLocalFiles("local/sync")).resolves.toEqual([
			{ path: "/active.json", fullPath: "/local/sync/active.json" },
		]);
	});
});
