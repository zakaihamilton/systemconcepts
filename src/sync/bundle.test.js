import storage from "@util/storage/storage";
import { readCompressedFile } from "./bundle";

jest.mock("@util/storage/storage", () => ({
	__esModule: true,
	default: { readFile: jest.fn() },
}));

describe("strict compressed reads", () => {
	it("propagates transient storage failures instead of treating them as missing", async () => {
		storage.readFile.mockRejectedValue(new Error("network failed"));

		await expect(
			readCompressedFile("aws/sync/files.json.gz", { strict: true }),
		).rejects.toThrow("network failed");
	});

	it("still treats a confirmed 404 as missing", async () => {
		storage.readFile.mockRejectedValue(new Error("Failed to fetch file: 404"));

		await expect(
			readCompressedFile("aws/sync/files.json.gz", { strict: true }),
		).resolves.toBeNull();
	});
});
