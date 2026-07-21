import storage from "@util/storage/storage";
import { readCompressedFile, writeCompressedFile } from "./bundle";
import { applyManifestUpdates, updateManifestEntry } from "./manifest";
import { readFileIfExists } from "./storageReads";

jest.mock("@util/storage/storage", () => ({
	__esModule: true,
	default: { writeFile: jest.fn() },
}));

jest.mock("./bundle", () => ({
	readCompressedFile: jest.fn(),
	writeCompressedFile: jest.fn(),
}));

jest.mock("./storageReads", () => ({ readFileIfExists: jest.fn() }));

describe("updateManifestEntry", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		writeCompressedFile.mockResolvedValue(undefined);
		storage.writeFile.mockResolvedValue(undefined);
	});

	it("appends a new entry to a compressed (.gz) manifest", async () => {
		readCompressedFile.mockResolvedValue([{ path: "/a.json", version: "1" }]);

		const manifest = await updateManifestEntry("/aws/sync/files.json.gz", {
			path: "/b.json",
			version: "1",
		});

		expect(manifest).toEqual([
			{ path: "/a.json", version: "1" },
			{ path: "/b.json", version: "1" },
		]);
		expect(writeCompressedFile).toHaveBeenCalledWith(
			"/aws/sync/files.json.gz",
			manifest,
		);
	});

	it("replaces an existing entry in a compressed manifest instead of duplicating it", async () => {
		readCompressedFile.mockResolvedValue([{ path: "/a.json", version: "1" }]);

		const manifest = await updateManifestEntry("/aws/sync/files.json.gz", {
			path: "/a.json",
			version: "2",
		});

		expect(manifest).toEqual([{ path: "/a.json", version: "2" }]);
	});

	it("reads and writes a plain .json manifest as JSON text", async () => {
		readFileIfExists.mockResolvedValue(
			JSON.stringify([{ path: "/a.json", version: "1" }]),
		);

		const manifest = await updateManifestEntry("/local/sync/files.json", {
			path: "/b.json",
			version: "1",
		});

		expect(storage.writeFile).toHaveBeenCalledWith(
			"/local/sync/files.json",
			JSON.stringify(manifest, null, 4),
		);
		expect(manifest).toHaveLength(2);
	});

	it("starts from an empty manifest when the .json file cannot be parsed", async () => {
		readFileIfExists.mockResolvedValue("{not json");

		const manifest = await updateManifestEntry("/local/sync/files.json", {
			path: "/b.json",
			version: "1",
		});

		expect(manifest).toEqual([{ path: "/b.json", version: "1" }]);
	});

	it("converts a legacy dictionary-style .json manifest into array form", async () => {
		readFileIfExists.mockResolvedValue(
			JSON.stringify({ "/a.json": { version: "1" } }),
		);

		const manifest = await updateManifestEntry("/local/sync/files.json", {
			path: "/b.json",
			version: "1",
		});

		expect(manifest).toEqual([
			{ path: "/a.json", version: "1" },
			{ path: "/b.json", version: "1" },
		]);
	});

	it("starts from an empty manifest when no .json file exists yet", async () => {
		readFileIfExists.mockResolvedValue(null);

		const manifest = await updateManifestEntry("/local/sync/files.json", {
			path: "/a.json",
			version: "1",
		});

		expect(manifest).toEqual([{ path: "/a.json", version: "1" }]);
	});
});

describe("applyManifestUpdates", () => {
	it("returns the base manifest unchanged when there are no updates", async () => {
		const base = [{ path: "/a.json", version: "1" }];
		expect(await applyManifestUpdates(base, [])).toBe(base);
		expect(await applyManifestUpdates(base, null)).toBe(base);
	});

	it("replaces existing entries in place and appends new ones", async () => {
		const base = [
			{ path: "/a.json", version: "1" },
			{ path: "/b.json", version: "1" },
		];

		const result = await applyManifestUpdates(base, [
			{ path: "/b.json", version: "2" },
			{ path: "/c.json", version: "1" },
		]);

		expect(result).toEqual([
			{ path: "/a.json", version: "1" },
			{ path: "/b.json", version: "2" },
			{ path: "/c.json", version: "1" },
		]);
		// The original base manifest must not be mutated.
		expect(base[1].version).toBe("1");
	});

	it("treats a non-array base manifest as empty", async () => {
		const result = await applyManifestUpdates(null, [
			{ path: "/a.json", version: "1" },
		]);
		expect(result).toEqual([{ path: "/a.json", version: "1" }]);
	});
});
