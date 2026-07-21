import storage from "@storage/wasabi";
import {
	fetchBlob,
	fetchJSON,
	fetchText,
	getStableFetchCacheOptions,
} from "@util/api/fetch";
import { logger as structuredLogger } from "@util/api/logger";
import { binaryToString } from "@util/data/binary";

jest.mock("@util/api/fetch", () => ({
	fetchBlob: jest.fn(),
	fetchJSON: jest.fn(),
	fetchText: jest.fn(),
	getStableFetchCacheOptions: jest.fn(() => ({ cacheResponse: true })),
}));
jest.mock("@util/api/logger", () => ({
	logger: { debug: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.mock("@util/data/binary", () => ({
	binaryToString: jest.fn(),
}));

function getQueryPath(url) {
	const match = url.match(/path=([^&]*)/);
	return match ? decodeURIComponent(match[1]) : "";
}

beforeEach(() => {
	jest.clearAllMocks();
});

describe("getListing", () => {
	it("maps device-prefixed ids and paths onto each entry", async () => {
		fetchJSON.mockResolvedValue([
			{ name: "file.txt", stat: { type: "file", size: 5 } },
		]);

		const [item] = await storage.getListing("root");

		expect(item).toMatchObject({
			name: "file.txt",
			type: "file",
			size: 5,
			id: "/wasabi/root/file.txt",
			path: "/wasabi/root/file.txt",
		});
		expect(fetchJSON.mock.calls[0][1]).toMatchObject({
			method: "GET",
			cache: "no-store",
		});
	});
});

describe("no-op operations", () => {
	it.each([
		["createFolder"],
		["createFolders"],
		["createFolderPath"],
		["deleteFolder"],
		["deleteFile"],
		["readFiles"],
		["writeFile"],
		["writeFiles"],
	])("%s resolves without contacting the network", async (method) => {
		await expect(storage[method]("root", "extra")).resolves.toBeUndefined();
		expect(fetchJSON).not.toHaveBeenCalled();
	});
});

describe("readFile", () => {
	it("fetches text content for non-binary files using the stable cache options", async () => {
		fetchText.mockResolvedValue("hello world");

		const result = await storage.readFile("root/file.txt");

		expect(result).toBe("hello world");
		expect(getStableFetchCacheOptions).toHaveBeenCalledWith(
			24 * 60 * 60 * 1000,
		);
		const [url, options] = fetchText.mock.calls[0];
		expect(url).toContain("type=file");
		expect(options).toMatchObject({ method: "GET", cacheResponse: true });
	});

	it("fetches and decodes binary content", async () => {
		const blob = new Blob(["binary"]);
		fetchBlob.mockResolvedValue(blob);
		binaryToString.mockReturnValue("encoded");

		const result = await storage.readFile("root/image.png");

		expect(result).toBe("encoded");
		expect(fetchBlob).toHaveBeenCalledWith(
			expect.stringContaining("binary=true"),
			{ method: "GET", cache: "default" },
		);
		expect(binaryToString).toHaveBeenCalledWith(blob);
	});
});

describe("getRecursiveList", () => {
	it("flattens nested directories detected via item.type", async () => {
		fetchJSON.mockImplementation((url) => {
			const path = getQueryPath(url);
			if (path === "/root") {
				return Promise.resolve([
					{ name: "file.txt", type: "file" },
					{ name: "sub", type: "dir" },
				]);
			}
			if (path === "/root/sub") {
				return Promise.resolve([{ name: "nested.txt", type: "file" }]);
			}
			return Promise.resolve([]);
		});

		const result = await storage.getRecursiveList("root");

		expect(result.map((item) => item.name).sort()).toEqual([
			"file.txt",
			"nested.txt",
		]);
	});

	it("detects directories via stat.type when item.type is absent", async () => {
		fetchJSON.mockImplementation((url) => {
			const path = getQueryPath(url);
			if (path === "/root") {
				return Promise.resolve([{ name: "sub", stat: { type: "dir" } }]);
			}
			return Promise.resolve([]);
		});

		const result = await storage.getRecursiveList("root");

		expect(result).toEqual([]);
		expect(fetchJSON).toHaveBeenCalledTimes(2);
	});

	it("detects directories via a trailing slash in the name", async () => {
		fetchJSON.mockImplementation((url) => {
			const path = getQueryPath(url);
			if (path === "/root") {
				return Promise.resolve([{ name: "sub/" }]);
			}
			return Promise.resolve([]);
		});

		const result = await storage.getRecursiveList("root");

		expect(result).toEqual([]);
		expect(fetchJSON).toHaveBeenCalledTimes(2);
	});

	it("logs and continues when listing a directory fails", async () => {
		fetchJSON.mockRejectedValue(new Error("network down"));

		const result = await storage.getRecursiveList("root");

		expect(result).toEqual([]);
		expect(structuredLogger.warn).toHaveBeenCalledWith(
			expect.stringContaining("Failed to list"),
			"network down",
		);
	});
});

describe("exists", () => {
	it("returns true for an existing file", async () => {
		fetchJSON.mockResolvedValue({ name: "file.txt", type: "file" });

		await expect(storage.exists("root/file.txt")).resolves.toBeTruthy();
	});

	it("returns false for a directory", async () => {
		fetchJSON.mockResolvedValue({ name: "sub", type: "dir" });

		await expect(storage.exists("root/sub")).resolves.toBe(false);
	});

	it("returns false for an x-directory mime type", async () => {
		fetchJSON.mockResolvedValue({
			name: "sub",
			type: "application/x-directory",
		});

		await expect(storage.exists("root/sub")).resolves.toBe(false);
	});

	it("returns false when the server responds with a directory listing", async () => {
		fetchJSON.mockResolvedValue([{ name: "a" }]);

		await expect(storage.exists("root")).resolves.toBe(false);
	});

	it("returns a falsy value when the item is missing", async () => {
		fetchJSON.mockResolvedValue(null);

		await expect(storage.exists("root/missing.txt")).resolves.toBeFalsy();
	});

	it("returns false and logs when fetchJSON throws", async () => {
		fetchJSON.mockRejectedValue(new Error("network error"));

		await expect(storage.exists("root/file.txt")).resolves.toBe(false);
		expect(structuredLogger.error).toHaveBeenCalled();
	});
});
