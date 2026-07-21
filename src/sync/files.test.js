import storage from "@util/storage/storage";
import { readCompressedFile, writeCompressedFile } from "./bundle";
import { readFile, writeFile } from "./files";

jest.mock("@util/storage/storage", () => ({
	__esModule: true,
	default: { exists: jest.fn() },
}));

jest.mock("./bundle", () => ({
	readCompressedFile: jest.fn(),
	writeCompressedFile: jest.fn(),
}));

describe("files.readFile", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("returns the default value when the file does not exist", async () => {
		storage.exists.mockResolvedValue(false);

		const result = await readFile("groups.json", { fallback: true });

		expect(result).toEqual({ fallback: true });
		expect(readCompressedFile).not.toHaveBeenCalled();
	});

	it("returns the parsed contents when the file exists", async () => {
		storage.exists.mockResolvedValue(true);
		readCompressedFile.mockResolvedValue({ groups: [] });

		const result = await readFile("groups.json");

		expect(readCompressedFile).toHaveBeenCalledWith("/local/sync/groups.json");
		expect(result).toEqual({ groups: [] });
	});

	it("falls back to the default value when the compressed file resolves to null", async () => {
		storage.exists.mockResolvedValue(true);
		readCompressedFile.mockResolvedValue(null);

		const result = await readFile("groups.json", { fallback: true });

		expect(result).toEqual({ fallback: true });
	});

	it("returns the default value and swallows errors from the storage layer", async () => {
		storage.exists.mockRejectedValue(new Error("storage unavailable"));

		const result = await readFile("groups.json", { fallback: true });

		expect(result).toEqual({ fallback: true });
	});
});

describe("files.writeFile", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("writes compressed content to the local sync base path", async () => {
		writeCompressedFile.mockResolvedValue(undefined);

		await writeFile("groups.json", { groups: [] });

		expect(writeCompressedFile).toHaveBeenCalledWith(
			"/local/sync/groups.json",
			{ groups: [] },
		);
	});

	it("propagates errors from the storage layer", async () => {
		writeCompressedFile.mockRejectedValue(new Error("disk full"));

		await expect(writeFile("groups.json", {})).rejects.toThrow("disk full");
	});
});
