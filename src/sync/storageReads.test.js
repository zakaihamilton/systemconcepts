import { readFileIfExists } from "./storageReads";

describe("readFileIfExists", () => {
	it("reads without making a separate existence request", async () => {
		const storage = {
			readFile: jest.fn().mockResolvedValue("content"),
			exists: jest.fn(),
		};

		await expect(readFileIfExists(storage, "aws/file.json")).resolves.toBe(
			"content",
		);
		expect(storage.readFile).toHaveBeenCalledTimes(1);
		expect(storage.exists).not.toHaveBeenCalled();
	});

	it.each([
		[Object.assign(new Error("missing"), { code: "ENOENT" })],
		[Object.assign(new Error("missing"), { name: "NoSuchKey" })],
		[new Error("Failed to fetch file: 404")],
	])("returns null for missing files", async (error) => {
		const storage = { readFile: jest.fn().mockRejectedValue(error) };
		await expect(
			readFileIfExists(storage, "aws/missing.json"),
		).resolves.toBeNull();
	});

	it("does not hide authentication or transient failures", async () => {
		const error = new Error("AUTHENTICATION_REQUIRED");
		const storage = { readFile: jest.fn().mockRejectedValue(error) };
		await expect(readFileIfExists(storage, "aws/file.json")).rejects.toBe(
			error,
		);
	});
});
