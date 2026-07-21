import { purgeApiCacheFromStorage } from "@util/api/apiCachePurgeClient";
import { logger } from "@util/api/logger";
import Cookies from "js-cookie";
import { writeCompressedFile } from "../bundle";
import { addSyncLog } from "../logs";
import { uploadManifest } from "./uploadManifest";

jest.mock("@util/api/apiCachePurgeClient", () => ({
	purgeApiCacheFromStorage: jest.fn().mockResolvedValue(1),
}));

jest.mock("@util/api/logger", () => ({
	logger: {
		debug: jest.fn(),
		error: jest.fn(),
		warn: jest.fn(),
		info: jest.fn(),
	},
}));

jest.mock("../bundle", () => ({
	writeCompressedFile: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../logs", () => ({
	addSyncLog: jest.fn(),
}));

jest.mock("js-cookie", () => ({
	get: jest.fn(),
}));

describe("uploadManifest", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		purgeApiCacheFromStorage.mockResolvedValue(1);
		writeCompressedFile.mockResolvedValue(undefined);
	});

	it("purges api-cache after a successful manifest upload", async () => {
		await uploadManifest([{ path: "/alpha.json", version: "1" }]);

		expect(writeCompressedFile).toHaveBeenCalled();
		expect(purgeApiCacheFromStorage).toHaveBeenCalledTimes(1);
	});

	it("publishes an authoritative empty manifest and purges the API cache", async () => {
		await uploadManifest([]);

		expect(writeCompressedFile).toHaveBeenCalledWith(
			"/aws/sync/files.json.gz",
			[],
		);
		expect(purgeApiCacheFromStorage).toHaveBeenCalled();
	});

	it("normalizes paths, keeps highest versions, and logs dedupes", async () => {
		await uploadManifest([
			{ path: "a.json", version: "1" },
			{ path: "/a.json", version: "3" },
			{ path: "/a.json", version: "2" },
			{ path: "b.json", version: "bad" },
			{ path: "b.json", version: "0" },
		]);

		expect(logger.debug).toHaveBeenCalledWith(
			expect.stringContaining("Removed"),
		);
		const [, normalized] = writeCompressedFile.mock.calls[0];
		expect(normalized.find((e) => e.path === "/a.json").version).toBe("3");
	});

	it("handles non-array manifests as empty", async () => {
		await uploadManifest(null);
		expect(writeCompressedFile).toHaveBeenCalledWith(
			"/aws/sync/files.json.gz",
			[],
		);
	});

	it("logs purge failures without failing the upload", async () => {
		purgeApiCacheFromStorage.mockRejectedValue(new Error("purge failed"));
		await uploadManifest([{ path: "/a.json", version: "1" }]);
		await Promise.resolve();
		expect(logger.error).toHaveBeenCalledWith(
			expect.stringContaining("Failed to purge"),
			expect.any(Error),
		);
	});

	it("warns visitors on ACCESS_DENIED without throwing", async () => {
		Cookies.get.mockReturnValue("visitor");
		writeCompressedFile.mockRejectedValue(
			Object.assign(new Error("ACCESS_DENIED"), { status: 403 }),
		);
		await expect(
			uploadManifest([{ path: "/a.json", version: "1" }]),
		).resolves.toBeUndefined();
		expect(addSyncLog).toHaveBeenCalledWith(
			expect.stringContaining("Visitor access restricted"),
			"warning",
		);
	});

	it("warns non-visitors on numeric 403 without throwing", async () => {
		Cookies.get.mockReturnValue("user");
		writeCompressedFile.mockRejectedValue(403);
		await expect(
			uploadManifest([{ path: "/a.json", version: "1" }]),
		).resolves.toBeUndefined();
		expect(addSyncLog).toHaveBeenCalledWith(
			"Skipping manifest upload (read-only access)",
			"warning",
		);
	});

	it("rethrows unexpected upload errors after logging", async () => {
		const err = new Error("network");
		writeCompressedFile.mockRejectedValue(err);
		await expect(
			uploadManifest([{ path: "/a.json", version: "1" }]),
		).rejects.toBe(err);
		expect(logger.error).toHaveBeenCalledWith(
			expect.stringContaining("Step 7 error"),
			err,
		);
	});
});
