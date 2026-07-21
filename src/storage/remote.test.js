import remoteStorage from "@storage/remote";
import { fetchJSON } from "@util/api/fetch";

jest.mock("@util/api/fetch", () => ({
	fetchJSON: jest.fn(),
}));

const fsEndPoint = "/api/personal";
const deviceId = "personal";
let storage;

beforeEach(() => {
	jest.clearAllMocks();
	storage = remoteStorage({ fsEndPoint, deviceId });
});

describe("getListing", () => {
	it("maps items into device-prefixed listing entries and skips deleted ones", async () => {
		fetchJSON.mockResolvedValue([
			{ name: "a.txt", stat: { type: "file", size: 3 } },
			{ name: "removed.txt", stat: { type: "file" }, deleted: true },
		]);

		const listing = await storage.getListing("root");

		expect(fetchJSON).toHaveBeenCalledWith(
			fsEndPoint,
			expect.objectContaining({ method: "GET" }),
		);
		expect(listing).toHaveLength(1);
		expect(listing[0]).toMatchObject({
			name: "a.txt",
			type: "file",
			size: 3,
			id: "/personal/root/a.txt",
			path: "/personal/root/a.txt",
		});
	});

	it("counts subdirectories when useCount is requested", async () => {
		fetchJSON
			.mockResolvedValueOnce([{ name: "sub", stat: { type: "dir" } }])
			.mockResolvedValueOnce([
				{ name: "a", stat: { type: "dir" } },
				{ name: "b", stat: { type: "file" } },
			]);

		const [item] = await storage.getListing("root", { useCount: true });

		expect(item.count).toBe(1);
		expect(fetchJSON).toHaveBeenCalledTimes(2);
	});

	it("does not fetch children for files even when useCount is requested", async () => {
		fetchJSON.mockResolvedValueOnce([
			{ name: "a.txt", stat: { type: "file" } },
		]);

		await storage.getListing("root", { useCount: true });

		expect(fetchJSON).toHaveBeenCalledTimes(1);
	});
});

describe("getRecursiveList", () => {
	it("returns an empty array when the root path does not exist", async () => {
		fetchJSON.mockResolvedValueOnce(null);

		const result = await storage.getRecursiveList("root");

		expect(result).toEqual([]);
	});

	it("returns only valid, non-deleted descendants and remaps ids", async () => {
		fetchJSON
			.mockResolvedValueOnce({ id: "/root" }) // exists() check
			.mockResolvedValueOnce([
				{ id: "/root/sub", folder: "/root", stat: { type: "dir" } },
				{
					id: "/root/sub/file.txt",
					folder: "/root/sub",
					stat: { type: "file", size: 10 },
				},
				{
					id: "/root/orphan.txt",
					folder: "/unknown",
					stat: { type: "file" },
				},
				{
					id: "/root/deleted.txt",
					folder: "/root",
					stat: { type: "file" },
					deleted: true,
				},
			]);

		const result = await storage.getRecursiveList("root");

		expect(result.map((item) => item.path).sort()).toEqual([
			"/personal/root/sub",
			"/personal/root/sub/file.txt",
		]);
	});

	it("normalizes trailing slashes when building the prefix filter", async () => {
		fetchJSON.mockResolvedValueOnce({ id: "/root/" }).mockResolvedValueOnce([]);

		await storage.getRecursiveList("root/");

		const secondCallHeaders = fetchJSON.mock.calls[1][1].headers;
		expect(decodeURIComponent(secondCallHeaders.prefix)).toBe("/root/");
	});
});

describe("createFolder", () => {
	it("creates the folder when it does not already exist", async () => {
		fetchJSON.mockResolvedValueOnce(null).mockResolvedValueOnce({});

		await storage.createFolder("root/new");

		expect(fetchJSON).toHaveBeenLastCalledWith(
			fsEndPoint,
			expect.objectContaining({ method: "PUT" }),
		);
		const body = JSON.parse(fetchJSON.mock.calls[1][1].body);
		expect(body[0]).toMatchObject({ id: "/root/new", name: "new" });
	});

	it("does nothing when the folder already exists", async () => {
		fetchJSON.mockResolvedValueOnce({ id: "/root/new" });

		await storage.createFolder("root/new");

		expect(fetchJSON).toHaveBeenCalledTimes(1);
	});
});

describe("createFolders", () => {
	it("writes a single batch for a small set of folders", async () => {
		fetchJSON.mockResolvedValue({});

		await storage.createFolders("root/", ["a", "b"]);

		expect(fetchJSON).toHaveBeenCalledTimes(1);
		const body = JSON.parse(fetchJSON.mock.calls[0][1].body);
		expect(body.map((entry) => entry.name)).toEqual(["a", "b"]);
	});

	it("flushes the batch mid-loop once the byte limit is exceeded", async () => {
		fetchJSON.mockResolvedValue({});
		const hugeName = "x".repeat(4_000_001);

		await storage.createFolders("root/", [hugeName, "small"]);

		expect(fetchJSON.mock.calls.length).toBeGreaterThanOrEqual(2);
	});
});

describe("createFolderPath", () => {
	it("only creates the missing segments of the path", async () => {
		fetchJSON.mockImplementation((_url, options) => {
			if (options.method === "GET") {
				const headers = options.headers || {};
				const id = headers.id && decodeURIComponent(headers.id);
				return Promise.resolve(id === "/root" ? { id: "/root" } : null);
			}
			return Promise.resolve({});
		});

		await storage.createFolderPath("root/sub/file.txt");

		const putCalls = fetchJSON.mock.calls.filter(
			([, options]) => options.method === "PUT",
		);
		const createdIds = putCalls.map(
			([, options]) => JSON.parse(options.body)[0].id,
		);
		expect(createdIds).toEqual(["/root/sub"]);
	});

	it("creates the final segment as a folder when isFolder is true", async () => {
		fetchJSON.mockResolvedValue(null);

		await storage.createFolderPath("root/sub", true);

		const putCalls = fetchJSON.mock.calls.filter(
			([, options]) => options.method === "PUT",
		);
		expect(putCalls.length).toBeGreaterThan(0);
	});
});

describe("deleteFolder", () => {
	it("recursively deletes child files and folders before marking itself deleted", async () => {
		fetchJSON.mockImplementation((_url, options) => {
			if (options.method === "GET") {
				const headers = options.headers || {};
				const query =
					headers.query && JSON.parse(decodeURIComponent(headers.query));
				if (query?.folder === "/root") {
					return Promise.resolve([
						{ name: "file.txt", stat: { type: "file" } },
						{ name: "sub", stat: { type: "dir" } },
					]);
				}
				return Promise.resolve([]);
			}
			return Promise.resolve({});
		});

		await storage.deleteFolder("root");

		const putBodies = fetchJSON.mock.calls
			.filter(([, options]) => options.method === "PUT")
			.map(([, options]) => JSON.parse(options.body)[0]);
		expect(putBodies.some((item) => item.id === "/root" && item.deleted)).toBe(
			true,
		);
	});
});

describe("deleteFile", () => {
	it("marks the file as deleted", async () => {
		fetchJSON.mockResolvedValue({});

		await storage.deleteFile("root/file.txt");

		const body = JSON.parse(fetchJSON.mock.calls[0][1].body);
		expect(body[0]).toMatchObject({ id: "/root/file.txt", deleted: true });
	});
});

describe("readFile", () => {
	it("returns the body for an existing, non-deleted file", async () => {
		fetchJSON.mockResolvedValue({ body: "hello", deleted: false });

		await expect(storage.readFile("root/file.txt")).resolves.toBe("hello");
	});

	it("returns a falsy value for a deleted file", async () => {
		fetchJSON.mockResolvedValue({ body: "hello", deleted: true });

		await expect(storage.readFile("root/file.txt")).resolves.toBe(false);
	});

	it("returns a falsy value when the item does not exist", async () => {
		fetchJSON.mockResolvedValue(null);

		await expect(storage.readFile("root/file.txt")).resolves.toBe(null);
	});
});

describe("readFiles", () => {
	it("resolves file bodies keyed by id and stops once all are found", async () => {
		fetchJSON.mockResolvedValueOnce([
			{ id: "/root/a.txt", body: "one" },
			{ id: "/root/b.txt", body: "two" },
		]);

		const result = await storage.readFiles("root/", ["a.txt", "b.txt"]);

		expect(result).toEqual({ "/root/a.txt": "one", "/root/b.txt": "two" });
		expect(fetchJSON).toHaveBeenCalledTimes(1);
	});

	it("stops looping when the server returns no further results", async () => {
		fetchJSON.mockResolvedValueOnce([]);

		const result = await storage.readFiles("root/", ["missing.txt"]);

		expect(result).toEqual({});
	});

	it("keeps requesting remaining files across multiple rounds", async () => {
		fetchJSON
			.mockResolvedValueOnce([{ id: "/root/a.txt", body: "one" }])
			.mockResolvedValueOnce([{ id: "/root/b.txt", body: "two" }]);

		const result = await storage.readFiles("root/", ["a.txt", "b.txt"]);

		expect(result).toEqual({ "/root/a.txt": "one", "/root/b.txt": "two" });
		expect(fetchJSON).toHaveBeenCalledTimes(2);
	});
});

describe("writeFile", () => {
	it("writes the file with a computed size", async () => {
		fetchJSON.mockResolvedValue({});

		await storage.writeFile("root/file.txt", "hello");

		const body = JSON.parse(fetchJSON.mock.calls[0][1].body);
		expect(body[0]).toMatchObject({
			id: "/root/file.txt",
			stat: { type: "file", size: 5 },
			body: "hello",
		});
	});

	it("defaults to an empty body", async () => {
		fetchJSON.mockResolvedValue({});

		await storage.writeFile("root/file.txt");

		const body = JSON.parse(fetchJSON.mock.calls[0][1].body);
		expect(body[0].body).toBe("");
	});
});

describe("writeFiles", () => {
	it("writes a single batch for small file sets", async () => {
		fetchJSON.mockResolvedValue({});

		await storage.writeFiles("root/", { "a.txt": "one", "b.txt": "two" });

		expect(fetchJSON).toHaveBeenCalledTimes(1);
		const body = JSON.parse(fetchJSON.mock.calls[0][1].body);
		expect(body.map((entry) => entry.name)).toEqual(["a.txt", "b.txt"]);
	});

	it("flushes the batch mid-loop once the byte limit is exceeded", async () => {
		fetchJSON.mockResolvedValue({});
		const hugeBody = "x".repeat(4_000_001);

		await storage.writeFiles("root/", { "a.txt": hugeBody, "b.txt": "small" });

		expect(fetchJSON.mock.calls.length).toBeGreaterThanOrEqual(2);
	});
});

describe("exists", () => {
	it("returns true for an existing, non-deleted item", async () => {
		fetchJSON.mockResolvedValue({ id: "/root/file.txt" });

		await expect(storage.exists("root/file.txt")).resolves.toBe(true);
	});

	it("returns false for a deleted item", async () => {
		fetchJSON.mockResolvedValue({ id: "/root/file.txt", deleted: true });

		await expect(storage.exists("root/file.txt")).resolves.toBe(false);
	});

	it("returns false when fetchJSON throws", async () => {
		fetchJSON.mockRejectedValue(new Error("network error"));

		await expect(storage.exists("root/file.txt")).resolves.toBe(false);
	});

	it("recursively deletes nested folders before marking the root deleted", async () => {
		fetchJSON.mockImplementation((_url, options) => {
			if (options.method === "GET") {
				const headers = options.headers || {};
				const query =
					headers.query && JSON.parse(decodeURIComponent(headers.query));
				if (query?.folder === "/root") {
					return Promise.resolve([
						{ name: "nested", stat: { type: "dir" } },
						{ name: "file.txt", stat: { type: "file" } },
					]);
				}
				if (query?.folder === "/root/nested") {
					return Promise.resolve([
						{ name: "inner.txt", stat: { type: "file" } },
					]);
				}
				return Promise.resolve([]);
			}
			return Promise.resolve({});
		});

		await storage.deleteFolder("root");

		const deletedIds = fetchJSON.mock.calls
			.filter(([, options]) => options.method === "PUT")
			.map(([, options]) => JSON.parse(options.body)[0].id);
		expect(deletedIds).toEqual(
			expect.arrayContaining([
				"/root/nested/inner.txt",
				"/root/file.txt",
				"/root",
			]),
		);
	});

	it("returns a falsy body when the file exists but has no content", async () => {
		fetchJSON.mockResolvedValue({ body: "", deleted: false });

		await expect(storage.readFile("root/file.txt")).resolves.toBe("");
	});
});
