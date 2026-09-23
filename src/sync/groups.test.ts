import { logger as structuredLogger } from "@util/api/logger";
import { readFile, writeFile } from "./files";
import { readGroups, writeGroups } from "./groups";

jest.mock("./files", () => ({
	readFile: jest.fn(),
	writeFile: jest.fn(),
}));

describe("readGroups", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("returns groups, settings, and version straight from storage", async () => {
		readFile.mockResolvedValue({
			groups: [{ name: "Alpha" }],
			settings: { theme: "dark" },
			version: 2,
		});

		const result = await readGroups();

		expect(readFile).toHaveBeenCalledWith("groups.json");
		expect(result).toEqual({
			groups: [{ name: "Alpha" }],
			settings: { theme: "dark" },
			version: 2,
		});
	});

	it("falls back to sensible defaults when fields are missing", async () => {
		readFile.mockResolvedValue({});

		const result = await readGroups();

		expect(result).toEqual({ groups: [], settings: {}, version: 1 });
	});

	it("returns defaults and logs an error instead of throwing when the read fails", async () => {
		readFile.mockRejectedValue(new Error("read failed"));
		const errorSpy = jest
			.spyOn(structuredLogger, "error")
			.mockImplementation(() => {});

		const result = await readGroups();

		expect(result).toEqual({ groups: [], settings: {}, version: 1 });
		expect(errorSpy).toHaveBeenCalled();
		errorSpy.mockRestore();
	});
});

describe("writeGroups", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("normalizes groups/settings and writes them under version 1", async () => {
		writeFile.mockResolvedValue(undefined);

		await writeGroups({ groups: [{ name: "Alpha" }], settings: { a: 1 } });

		expect(writeFile).toHaveBeenCalledWith("groups.json", {
			version: 1,
			groups: [{ name: "Alpha" }],
			settings: { a: 1 },
		});
	});

	it("defaults groups/settings to empty when omitted", async () => {
		writeFile.mockResolvedValue(undefined);

		await writeGroups({});

		expect(writeFile).toHaveBeenCalledWith("groups.json", {
			version: 1,
			groups: [],
			settings: {},
		});
	});

	it("propagates errors from the underlying write", async () => {
		writeFile.mockRejectedValue(new Error("disk full"));

		await expect(writeGroups({})).rejects.toThrow("disk full");
	});
});
