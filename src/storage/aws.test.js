import storage from "@storage/aws";
import { fetchJSON, requireRelogin } from "@util/api/fetch";
import { binaryToString } from "@util/data/binary";

jest.mock("@util/data/binary", () => ({
	binaryToString: jest.fn(),
}));
jest.mock("@util/api/fetch", () => ({
	fetchJSON: jest.fn(),
	requireRelogin: jest.fn(),
}));
jest.mock("@util/api/logger", () => ({
	logger: { debug: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

function getQueryPath(url) {
	const match = url.match(/path=([^&]*)/);
	return match ? decodeURIComponent(match[1]) : "";
}

function response({
	status = 200,
	ok = status >= 200 && status < 300,
	contentType = "application/octet-stream",
	text = jest.fn().mockResolvedValue(""),
	blob = jest.fn().mockResolvedValue(new Blob([])),
} = {}) {
	return {
		status,
		ok,
		headers: { get: jest.fn(() => contentType) },
		text,
		blob,
	};
}

describe("AWS storage authentication", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		global.fetch = jest.fn();
	});

	it("requires re-login when a direct file read receives 401", async () => {
		const res = {
			status: 401,
			ok: false,
			headers: { get: jest.fn(() => "application/json") },
		};
		global.fetch.mockResolvedValue(res);
		requireRelogin.mockReturnValue(true);

		await expect(
			storage.readFile("aws/personal/user/manifest.json"),
		).rejects.toThrow("AUTHENTICATION_REQUIRED");

		expect(requireRelogin).toHaveBeenCalledWith(res);
	});

	it("requests directory counts in the original listing call", async () => {
		fetchJSON.mockResolvedValue([
			{ type: "dir", name: "2025", count: 12 },
			{ type: "dir", name: "2026", count: 4 },
		]);

		const listing = await storage.getListing("sessions-counts-test", {
			useCount: true,
		});

		expect(fetchJSON).toHaveBeenCalledTimes(1);
		expect(fetchJSON).toHaveBeenCalledWith(
			"/api/aws?path=sessions-counts-test&type=dir&counts=1",
			{ method: "GET", cache: "no-store" },
		);
		expect(listing.map(({ name, count }) => ({ name, count }))).toEqual([
			{ name: "2025", count: 12 },
			{ name: "2026", count: 4 },
		]);
	});
});

describe("getListing", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		global.fetch = jest.fn();
	});

	it("maps device-prefixed ids and paths onto each entry", async () => {
		fetchJSON.mockResolvedValue([
			{ name: "file.txt", stat: { type: "file", size: 12 } },
		]);

		const [item] = await storage.getListing("listing-basic-test");

		expect(item).toMatchObject({
			name: "file.txt",
			type: "file",
			size: 12,
			id: "/aws/listing-basic-test/file.txt",
			path: "/aws/listing-basic-test/file.txt",
		});
	});

	it("caches repeated listing requests for the same path", async () => {
		fetchJSON.mockResolvedValue([]);

		await storage.getListing("listing-cache-test");
		await storage.getListing("listing-cache-test");

		expect(fetchJSON).toHaveBeenCalledTimes(1);
	});
});

describe("deleteFolder", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		global.fetch = jest.fn();
	});

	it("recursively deletes file and directory children before removing itself", async () => {
		fetchJSON.mockImplementation((url, options) => {
			if (options?.method === "DELETE") return Promise.resolve({});
			if (getQueryPath(url) === "delete-folder-test") {
				return Promise.resolve([
					{ name: "file.txt", stat: { type: "file" } },
					{ name: "sub", type: "dir" },
				]);
			}
			return Promise.resolve([]);
		});

		await storage.deleteFolder("delete-folder-test");

		const deleteCalls = fetchJSON.mock.calls.filter(
			([, options]) => options?.method === "DELETE",
		);
		const deletedPaths = deleteCalls.map(([url]) => decodeURIComponent(url));
		expect(
			deletedPaths.some((url) => url.includes("delete-folder-test/file.txt")),
		).toBe(true);
		expect(
			deletedPaths.some((url) => url.includes("delete-folder-test/sub")),
		).toBe(true);
		expect(
			deletedPaths.some(
				(url) =>
					url.includes("path=delete-folder-test") &&
					!url.includes("file.txt") &&
					!url.includes("/sub"),
			),
		).toBe(true);
	});
});

describe("deleteFile", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		global.fetch = jest.fn();
	});

	it("issues a DELETE request and invalidates the read cache", async () => {
		fetchJSON.mockResolvedValueOnce({ name: "file.txt" });
		await storage.exists("delete-file-cache-test");
		expect(fetchJSON).toHaveBeenCalledTimes(1);

		fetchJSON.mockResolvedValueOnce({});
		await storage.deleteFile("delete-file-cache-test");
		expect(fetchJSON).toHaveBeenCalledTimes(2);
		expect(fetchJSON.mock.calls[1][1]).toMatchObject({ method: "DELETE" });

		fetchJSON.mockResolvedValueOnce({ name: "file.txt" });
		await storage.exists("delete-file-cache-test");
		expect(fetchJSON).toHaveBeenCalledTimes(3);
	});
});

describe("readFile", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		global.fetch = jest.fn();
		requireRelogin.mockReturnValue(false);
	});

	it("returns text content for a plain-text file", async () => {
		global.fetch.mockResolvedValue(
			response({
				contentType: "text/plain",
				text: jest.fn().mockResolvedValue("hello"),
			}),
		);

		await expect(storage.readFile("aws/plain.txt")).resolves.toBe("hello");
	});

	it("converts binary blobs via binaryToString", async () => {
		const blob = new Blob(["binary"]);
		global.fetch.mockResolvedValue(
			response({
				contentType: "image/png",
				blob: jest.fn().mockResolvedValue(blob),
			}),
		);
		binaryToString.mockResolvedValue("encoded");

		await expect(storage.readFile("aws/image.png")).resolves.toBe("encoded");
		expect(binaryToString).toHaveBeenCalledWith(blob);
	});

	it("throws when the response status is not ok and not 401", async () => {
		global.fetch.mockResolvedValue(response({ status: 500, ok: false }));

		await expect(storage.readFile("aws/broken.txt")).rejects.toThrow(
			"Failed to fetch file: 500",
		);
	});

	it("follows a signed URL envelope and returns text content", async () => {
		global.fetch
			.mockResolvedValueOnce(
				response({
					contentType: "application/json",
					text: jest
						.fn()
						.mockResolvedValue(
							JSON.stringify({ signedUrl: "https://signed.example/file.txt" }),
						),
				}),
			)
			.mockResolvedValueOnce(
				response({ text: jest.fn().mockResolvedValue("signed body") }),
			);

		await expect(storage.readFile("aws/redirected.txt")).resolves.toBe(
			"signed body",
		);
		expect(global.fetch).toHaveBeenNthCalledWith(
			2,
			"https://signed.example/file.txt",
		);
	});

	it("follows a signed URL envelope for binary content", async () => {
		const blob = new Blob(["binary"]);
		global.fetch
			.mockResolvedValueOnce(
				response({
					contentType: "application/json",
					text: jest
						.fn()
						.mockResolvedValue(
							JSON.stringify({ signedUrl: "https://signed.example/image.png" }),
						),
				}),
			)
			.mockResolvedValueOnce(
				response({ blob: jest.fn().mockResolvedValue(blob) }),
			);
		binaryToString.mockResolvedValue("encoded-binary");

		await expect(storage.readFile("aws/redirected.png")).resolves.toBe(
			"encoded-binary",
		);
	});

	it("throws when the signed URL fetch fails", async () => {
		global.fetch
			.mockResolvedValueOnce(
				response({
					contentType: "application/json",
					text: jest.fn().mockResolvedValue(
						JSON.stringify({
							signedUrl: "https://signed.example/missing.txt",
						}),
					),
				}),
			)
			.mockResolvedValueOnce(response({ status: 404, ok: false }));

		await expect(storage.readFile("aws/missing.txt")).rejects.toThrow(
			"Failed to fetch from signed URL: 404",
		);
	});

	it("throws when the JSON body is a directory listing", async () => {
		global.fetch.mockResolvedValue(
			response({
				contentType: "application/json",
				text: jest.fn().mockResolvedValue(JSON.stringify([{ name: "a" }])),
			}),
		);

		await expect(storage.readFile("aws/some/dir")).rejects.toThrow(
			"Cannot read directory as file",
		);
	});

	it("falls back to text content when the JSON body cannot be parsed", async () => {
		global.fetch.mockResolvedValue(
			response({
				contentType: "application/json",
				text: jest.fn().mockResolvedValue("not actually json"),
			}),
		);

		await expect(storage.readFile("aws/weird.json")).resolves.toBe(
			"not actually json",
		);
	});
});

describe("readFiles", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		global.fetch = jest.fn();
		requireRelogin.mockReturnValue(false);
	});

	it("reads multiple files relative to a prefix and skips null content", async () => {
		global.fetch.mockImplementation((url) => {
			if (url.includes("a.txt")) {
				return Promise.resolve(
					response({
						contentType: "text/plain",
						text: jest.fn().mockResolvedValue("A"),
					}),
				);
			}
			return Promise.resolve({
				status: 404,
				ok: false,
				headers: { get: () => "" },
			});
		});

		const results = await storage.readFiles("prefix", [
			"a.txt",
			"missing.tags",
		]);

		expect(results).toEqual({ "a.txt": "A" });
	});

	it("adds a trailing slash to the prefix when missing", async () => {
		global.fetch.mockResolvedValue(response({ status: 404, ok: false }));

		await storage.readFiles("prefix-no-slash", ["a.txt"]);

		expect(global.fetch.mock.calls[0][0]).toContain(
			encodeURIComponent("prefix-no-slash/a.txt"),
		);
	});

	it("re-throws AUTHENTICATION_REQUIRED errors", async () => {
		global.fetch.mockResolvedValue({
			status: 401,
			ok: false,
			headers: { get: () => "application/json" },
		});
		requireRelogin.mockReturnValue(true);

		await expect(storage.readFiles("prefix/", ["secure.txt"])).rejects.toThrow(
			"AUTHENTICATION_REQUIRED",
		);
	});

	it("logs unexpected read errors but continues", async () => {
		const { logger } = require("@util/api/logger");
		global.fetch.mockResolvedValue({
			status: 500,
			ok: false,
			headers: { get: () => "" },
		});

		const results = await storage.readFiles("prefix/", ["broken.txt"]);

		expect(results).toEqual({});
		expect(logger.warn).toHaveBeenCalled();
	});
});

describe("writeFile", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		global.fetch = jest.fn();
	});

	it("uploads directly to the signed URL for JSON content", async () => {
		fetchJSON.mockResolvedValue({ url: "https://signed.example/upload" });
		global.fetch.mockResolvedValue({ ok: true });

		await storage.writeFile("aws/data.json", '{"a":1}');

		expect(global.fetch).toHaveBeenCalledWith(
			"https://signed.example/upload",
			expect.objectContaining({ method: "PUT", body: '{"a":1}' }),
		);
	});

	it("decodes base64 gzip payloads before uploading directly", async () => {
		fetchJSON.mockResolvedValue({ url: "https://signed.example/upload.gz" });
		global.fetch.mockResolvedValue({ ok: true });
		const base64Body = Buffer.from("gzip-body").toString("base64");

		await storage.writeFile("aws/archive.gz", base64Body);

		const [, options] = global.fetch.mock.calls[0];
		expect(options.body).toBeInstanceOf(Uint8Array);
	});

	it("falls back to the proxy endpoint when the signed URL request fails", async () => {
		fetchJSON.mockResolvedValueOnce({ err: "no signed url" });
		fetchJSON.mockResolvedValueOnce({});

		await storage.writeFile("aws/fallback.json", "body");

		expect(fetchJSON).toHaveBeenCalledTimes(2);
		expect(fetchJSON.mock.calls[1][0]).toBe("/api/aws");
		expect(fetchJSON.mock.calls[1][1]).toMatchObject({ method: "PUT" });
	});

	it("falls back to the proxy endpoint when no signed url is returned", async () => {
		fetchJSON.mockResolvedValueOnce({});
		fetchJSON.mockResolvedValueOnce({});

		await storage.writeFile("aws/no-url.json", "body");

		expect(fetchJSON).toHaveBeenCalledTimes(2);
	});

	it("falls back to the proxy endpoint when the direct upload response is not ok", async () => {
		fetchJSON.mockResolvedValueOnce({ url: "https://signed.example/upload" });
		fetchJSON.mockResolvedValueOnce({});
		global.fetch.mockResolvedValue({
			ok: false,
			status: 500,
			text: jest.fn().mockResolvedValue("server error"),
		});

		await storage.writeFile("aws/upload-fails.json", "body");

		expect(fetchJSON).toHaveBeenCalledTimes(2);
		expect(fetchJSON.mock.calls[1][1]).toMatchObject({ method: "PUT" });
	});

	it("base64-encodes binary bodies when falling back to the proxy", async () => {
		fetchJSON.mockResolvedValueOnce({});
		fetchJSON.mockResolvedValueOnce({});
		binaryToString.mockResolvedValue("base64-body");

		await storage.writeFile("aws/image.png", new Uint8Array([1, 2, 3]));

		expect(binaryToString).toHaveBeenCalled();
		const body = JSON.parse(fetchJSON.mock.calls[1][1].body);
		expect(body[0].body).toBe("base64-body");
	});
});

describe("writeFiles", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		global.fetch = jest.fn();
	});

	it("writes every file in the map relative to the prefix", async () => {
		fetchJSON.mockResolvedValue({ url: "https://signed.example/upload" });
		global.fetch.mockResolvedValue({ ok: true });

		await storage.writeFiles("prefix/", { "a.txt": "one", "b.txt": "two" });

		expect(global.fetch).toHaveBeenCalledTimes(2);
	});

	it("defaults missing file bodies to an empty string", async () => {
		fetchJSON.mockResolvedValue({ url: "https://signed.example/upload" });
		global.fetch.mockResolvedValue({ ok: true });

		await storage.writeFiles("prefix/", { "empty.txt": null });

		expect(global.fetch).toHaveBeenCalledWith(
			"https://signed.example/upload",
			expect.objectContaining({ body: "" }),
		);
	});
});

describe("getRecursiveList", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		global.fetch = jest.fn();
	});

	it("flattens nested directories into a single file listing", async () => {
		fetchJSON.mockImplementation((url) => {
			const path = getQueryPath(url);
			if (path === "recursive-root") {
				return Promise.resolve([
					{ name: "file.txt", stat: { type: "file" } },
					{ name: "sub", stat: { type: "dir" } },
				]);
			}
			if (path === "recursive-root/sub") {
				return Promise.resolve([
					{ name: "nested.txt", stat: { type: "file" } },
				]);
			}
			return Promise.resolve([]);
		});

		const result = await storage.getRecursiveList("recursive-root");

		expect(result.map((item) => item.name).sort()).toEqual([
			"file.txt",
			"nested.txt",
		]);
	});

	it("avoids revisiting the same directory when duplicate entries are listed", async () => {
		fetchJSON.mockImplementation((url) => {
			const path = getQueryPath(url);
			if (path === "dedup-root") {
				return Promise.resolve([
					{ name: "sub", stat: { type: "dir" } },
					{ name: "sub", stat: { type: "dir" } },
				]);
			}
			return Promise.resolve([]);
		});

		await storage.getRecursiveList("dedup-root");

		const listCalls = fetchJSON.mock.calls.filter(
			([url]) => getQueryPath(url) === "dedup-root/sub",
		);
		expect(listCalls).toHaveLength(1);
	});

	it("stops recursion once the max depth is exceeded", async () => {
		const { logger } = require("@util/api/logger");
		fetchJSON.mockImplementation((url) => {
			const match = url.match(/path=([^&]*)/);
			const path = match ? decodeURIComponent(match[1]) : "";
			const depth = path.split("/").filter(Boolean).length;
			return Promise.resolve([
				{ name: `d${depth + 1}`, stat: { type: "dir" } },
			]);
		});

		const result = await storage.getRecursiveList("deep-root");

		expect(result).toEqual([]);
		expect(logger.warn).toHaveBeenCalledWith(
			expect.stringContaining("depth exceeded"),
		);
	});

	it("logs and continues when listing a directory fails", async () => {
		const { logger } = require("@util/api/logger");
		fetchJSON.mockRejectedValue(new Error("network down"));

		const result = await storage.getRecursiveList("failing-root");

		expect(result).toEqual([]);
		expect(logger.warn).toHaveBeenCalled();
	});

	it("propagates listing errors in strict mode", async () => {
		fetchJSON.mockRejectedValue(new Error("network down"));

		await expect(
			storage.getRecursiveList("failing-root-strict", { strict: true }),
		).rejects.toThrow("network down");
	});
});

describe("exists", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		global.fetch = jest.fn();
	});

	it("returns true for an existing file", async () => {
		fetchJSON.mockResolvedValue({ name: "file.txt", type: "file" });

		await expect(storage.exists("exists-file-test")).resolves.toBeTruthy();
	});

	it("returns false for a directory", async () => {
		fetchJSON.mockResolvedValue({ name: "sub", type: "dir" });

		await expect(storage.exists("exists-dir-test")).resolves.toBe(false);
	});

	it("returns false for an x-directory mime type", async () => {
		fetchJSON.mockResolvedValue({
			name: "sub",
			type: "application/x-directory",
		});

		await expect(storage.exists("exists-xdir-test")).resolves.toBe(false);
	});

	it("returns false when the server responds with a directory listing", async () => {
		fetchJSON.mockResolvedValue([{ name: "a" }]);

		await expect(storage.exists("exists-array-test")).resolves.toBe(false);
	});

	it("returns false when the item is missing", async () => {
		fetchJSON.mockResolvedValue(null);

		await expect(storage.exists("exists-missing-test")).resolves.toBeFalsy();
	});

	it("returns false and logs when fetchJSON throws", async () => {
		const { logger } = require("@util/api/logger");
		fetchJSON.mockRejectedValue(new Error("network error"));

		await expect(storage.exists("exists-error-test")).resolves.toBe(false);
		expect(logger.error).toHaveBeenCalled();
	});
});
