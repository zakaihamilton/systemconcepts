import { purgeApiCacheFromStorage } from "@util/api/apiCachePurgeClient";
import { writeCompressedFile } from "../bundle";
import { uploadManifest } from "./uploadManifest";

jest.mock("@util/api/apiCachePurgeClient", () => ({
	purgeApiCacheFromStorage: jest.fn().mockResolvedValue(1),
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
	});

	it("purges api-cache after a successful manifest upload", async () => {
		await uploadManifest([{ path: "/alpha.json", version: "1" }]);

		expect(writeCompressedFile).toHaveBeenCalled();
		expect(purgeApiCacheFromStorage).toHaveBeenCalledTimes(1);
	});

	it("does not purge when manifest upload is skipped", async () => {
		await uploadManifest([]);

		expect(writeCompressedFile).not.toHaveBeenCalled();
		expect(purgeApiCacheFromStorage).not.toHaveBeenCalled();
	});
});
