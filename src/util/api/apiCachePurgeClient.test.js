import storage from "@util/storage/storage";
import { purgeApiCacheFromStorage } from "./apiCachePurgeClient";

jest.mock("@util/storage/storage", () => ({
	exists: jest.fn(),
	deleteFolder: jest.fn(),
}));

describe("purgeApiCacheFromStorage", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("returns 0 when the api-cache folder does not exist", async () => {
		storage.exists.mockResolvedValue(false);
		await expect(purgeApiCacheFromStorage()).resolves.toBe(0);
		expect(storage.deleteFolder).not.toHaveBeenCalled();
	});

	it("deletes the folder and returns 1 when it exists", async () => {
		storage.exists.mockResolvedValue(true);
		storage.deleteFolder.mockResolvedValue(undefined);
		await expect(purgeApiCacheFromStorage()).resolves.toBe(1);
		expect(storage.deleteFolder).toHaveBeenCalledWith("aws/api-cache");
	});

	it("swallows a 'no such key' style error and returns 0", async () => {
		storage.exists.mockResolvedValue(true);
		storage.deleteFolder.mockRejectedValue(new Error("No Such Key"));
		await expect(purgeApiCacheFromStorage()).resolves.toBe(0);
	});

	it("swallows an ENOENT error and returns 0", async () => {
		storage.exists.mockResolvedValue(true);
		storage.deleteFolder.mockRejectedValue(new Error("ENOENT: missing"));
		await expect(purgeApiCacheFromStorage()).resolves.toBe(0);
	});

	it("rethrows unrelated errors", async () => {
		storage.exists.mockResolvedValue(true);
		storage.deleteFolder.mockRejectedValue(new Error("permission denied"));
		await expect(purgeApiCacheFromStorage()).rejects.toThrow(
			"permission denied",
		);
	});

	it("rethrows errors without a message", async () => {
		storage.exists.mockResolvedValue(true);
		storage.deleteFolder.mockRejectedValue("plain string error");
		await expect(purgeApiCacheFromStorage()).rejects.toBe("plain string error");
	});
});
