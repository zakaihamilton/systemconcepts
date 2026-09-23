import remoteStorage from "@storage/remote";
import { fetchJSON } from "@util/api/fetch";

jest.mock("@util/api/fetch", () => ({
	fetchJSON: jest.fn(),
}));

const fsEndPoint = "/api/personal";
const deviceId = "personal";
let storage: any;

beforeEach(() => {
	jest.clearAllMocks();
	storage = remoteStorage({ fsEndPoint, deviceId });
});

describe("getListing", () => {
	it("maps items into device-prefixed listing entries and skips deleted ones", async () => {
		asMock(fetchJSON).mockResolvedValue([
			{ name: "a.txt", stat: { type: "file", size: 3 } },
			{ name: "removed.txt", stat: { type: "file" }, deleted: true },
		]);

		const listing: any = await storage.getListing("root");

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
		asMock(fetchJSON)
			.mockResolvedValueOnce([{ name: "sub", stat: { type: "dir" } }])
			.mockResolvedValueOnce([
				{ name: "a", stat: { type: "dir" } },
				{ name: "b", stat: { type: "file" } },
			]);

		const [item]: any = await storage.getListing("root", { useCount: true });

		expect(item.count).toBe(1);
		expect(fetchJSON).toHaveBeenCalledTimes(2);
	});

	it("does not fetch children for files even when useCount is requested", async () => {
		asMock(fetchJSON).mockResolvedValueOnce([
			{ name: "a.txt", stat: { type: "file" } },
		]);

		await storage.getListing("root", { useCount: true });

		expect(fetchJSON).toHaveBeenCalledTimes(1);
	});
});

describe("getRecursiveList", () => {
	it("returns an empty array when the root path does not exist", async () => {
		asMock(fetchJSON).mockResolvedValueOnce(null);

		const result: any = await storage.getRecursiveList("root");

		expect(result).toEqual([]);
	});

	it("returns only valid, non-deleted descendants and remaps ids", async () => {
		asMock(fetchJSON)
			.mockResolvedValueOnce({ id: "/root" }) // exists() asMock(check)
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

		const result: any = await storage.getRecursiveList("root");

		expect(result.map((item: any) => item.path).sort()).toEqual([
			"/personal/root/sub",
			"/personal/root/sub/file.txt",
		]);
	});

	it("normalizes trailing slashes when building the prefix filter", async () => {
		asMock(fetchJSON)
			.mockResolvedValueOnce({ id: "/root/" })
			.mockResolvedValueOnce([]);

		await storage.getRecursiveList("root/");

		const secondCallHeaders = asMock(fetchJSON).mock.calls[1][1].headers;
		expect(decodeURIComponent(secondCallHeaders.prefix)).toBe("/root/");
	});
});

describe("createFolder", () => {
	it("creates the folder when it does not already exist", async () => {
		asMock(fetchJSON).mockResolvedValueOnce(null).mockResolvedValueOnce({});

		await storage.createFolder("root/new");

		expect(fetchJSON).toHaveBeenLastCalledWith(
			fsEndPoint,
			expect.objectContaining({ method: "PUT" }),
		);
		const body = JSON.parse(asMock(fetchJSON).mock.calls[1][1].body);
		expect(body[0]).toMatchObject({ id: "/root/new", name: "new" });
	});

	it("does nothing when the folder already exists", async () => {
		asMock(fetchJSON).mockResolvedValueOnce({ id: "/root/new" });

		await storage.createFolder("root/new");

		expect(fetchJSON).toHaveBeenCalledTimes(1);
	});
});

describe("createFolders", () => {
	it("writes a single batch for a small set of folders", async () => {
		asMock(fetchJSON).mockResolvedValue({});

		await storage.createFolders("root/", ["a", "b"]);

		expect(fetchJSON).toHaveBeenCalledTimes(1);
		const body = JSON.parse(asMock(fetchJSON).mock.calls[0][1].body);
		expect(body.map((entry: any) => entry.name)).toEqual(["a", "b"]);
	});

	it("flushes the batch mid-loop once the byte limit is exceeded", async () => {
		asMock(fetchJSON).mockResolvedValue({});
		const hugeName = "x".repeat(4_000_001);

		await storage.createFolders("root/", [hugeName, "small"]);

		expect(asMock(fetchJSON).mock.calls.length).toBeGreaterThanOrEqual(2);
	});
});

describe("createFolderPath", () => {
	it("only creates the missing segments of the path", async () => {
		asMock(fetchJSON).mockImplementation((_url: any, options: any) => {
			if (options.method === "GET") {
				const headers = options.headers || {};
				const id = headers.id && decodeURIComponent(headers.id);
				return Promise.resolve(id === "/root" ? { id: "/root" } : null);
			}
			return Promise.resolve({});
		});

		await storage.createFolderPath("root/sub/file.txt");

		const putCalls = asMock(fetchJSON).mock.calls.filter(
			([, options]: any) => options.method === "PUT",
		);
		const createdIds = putCalls.map(
			([, options]: any) => JSON.parse(options.body)[0].id,
		);
		expect(createdIds).toEqual(["/root/sub"]);
	});

	it("creates the final segment as a folder when isFolder is true", async () => {
		asMock(fetchJSON).mockResolvedValue(null);

		await storage.createFolderPath("root/sub", true);

		const putCalls = asMock(fetchJSON).mock.calls.filter(
			([, options]: any) => options.method === "PUT",
		);
		expect(putCalls.length).toBeGreaterThan(0);
	});
});

describe("deleteFolder", () => {
	it("recursively deletes child files and folders before marking itself deleted", async () => {
		asMock(fetchJSON).mockImplementation((_url: any, options: any) => {
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

		const putBodies = asMock(fetchJSON)
			.mock.calls.filter(([, options]: any) => options.method === "PUT")
			.map(([, options]: any) => JSON.parse(options.body)[0]);
		expect(
			putBodies.some((item: any) => item.id === "/root" && item.deleted),
		).toBe(true);
	});
});

describe("deleteFile", () => {
	it("marks the file as deleted", async () => {
		asMock(fetchJSON).mockResolvedValue({});

		await storage.deleteFile("root/file.txt");

		const body = JSON.parse(asMock(fetchJSON).mock.calls[0][1].body);
		expect(body[0]).toMatchObject({ id: "/root/file.txt", deleted: true });
	});
});

describe("readFile", () => {
	it("returns the body for an existing, non-deleted file", async () => {
		asMock(fetchJSON).mockResolvedValue({ body: "hello", deleted: false });

		await expect(storage.readFile("root/file.txt")).resolves.toBe("hello");
	});

	it("returns a falsy value for a deleted file", async () => {
		asMock(fetchJSON).mockResolvedValue({ body: "hello", deleted: true });

		await expect(storage.readFile("root/file.txt")).resolves.toBe(false);
	});

	it("returns a falsy value when the item does not exist", async () => {
		asMock(fetchJSON).mockResolvedValue(null);

		await expect(storage.readFile("root/file.txt")).resolves.toBe(null);
	});
});

describe("readFiles", () => {
	it("resolves file bodies keyed by id and stops once all are found", async () => {
		asMock(fetchJSON).mockResolvedValueOnce([
			{ id: "/root/a.txt", body: "one" },
			{ id: "/root/b.txt", body: "two" },
		]);

		const result: any = await storage.readFiles("root/", ["a.txt", "b.txt"]);

		expect(result).toEqual({ "/root/a.txt": "one", "/root/b.txt": "two" });
		expect(fetchJSON).toHaveBeenCalledTimes(1);
	});

	it("stops looping when the server returns no further results", async () => {
		asMock(fetchJSON).mockResolvedValueOnce([]);

		const result: any = await storage.readFiles("root/", ["missing.txt"]);

		expect(result).toEqual({});
	});

	it("keeps requesting remaining files across multiple rounds", async () => {
		asMock(fetchJSON)
			.mockResolvedValueOnce([{ id: "/root/a.txt", body: "one" }])
			.mockResolvedValueOnce([{ id: "/root/b.txt", body: "two" }]);

		const result: any = await storage.readFiles("root/", ["a.txt", "b.txt"]);

		expect(result).toEqual({ "/root/a.txt": "one", "/root/b.txt": "two" });
		expect(fetchJSON).toHaveBeenCalledTimes(2);
	});
});

describe("writeFile", () => {
	it("writes the file with a computed size", async () => {
		asMock(fetchJSON).mockResolvedValue({});

		await storage.writeFile("root/file.txt", "hello");

		const body = JSON.parse(asMock(fetchJSON).mock.calls[0][1].body);
		expect(body[0]).toMatchObject({
			id: "/root/file.txt",
			stat: { type: "file", size: 5 },
			body: "hello",
		});
	});

	it("defaults to an empty body", async () => {
		asMock(fetchJSON).mockResolvedValue({});

		await storage.writeFile("root/file.txt");

		const body = JSON.parse(asMock(fetchJSON).mock.calls[0][1].body);
		expect(body[0].body).toBe("");
	});
});

describe("writeFiles", () => {
	it("writes a single batch for small file sets", async () => {
		asMock(fetchJSON).mockResolvedValue({});

		await storage.writeFiles("root/", { "a.txt": "one", "b.txt": "two" });

		expect(fetchJSON).toHaveBeenCalledTimes(1);
		const body = JSON.parse(asMock(fetchJSON).mock.calls[0][1].body);
		expect(body.map((entry: any) => entry.name)).toEqual(["a.txt", "b.txt"]);
	});

	it("flushes the batch mid-loop once the byte limit is exceeded", async () => {
		asMock(fetchJSON).mockResolvedValue({});
		const hugeBody = "x".repeat(4_000_001);

		await storage.writeFiles("root/", { "a.txt": hugeBody, "b.txt": "small" });

		expect(asMock(fetchJSON).mock.calls.length).toBeGreaterThanOrEqual(2);
	});
});

describe("exists", () => {
	it("returns true for an existing, non-deleted item", async () => {
		asMock(fetchJSON).mockResolvedValue({ id: "/root/file.txt" });

		await expect(storage.exists("root/file.txt")).resolves.toBe(true);
	});

	it("returns false for a deleted item", async () => {
		asMock(fetchJSON).mockResolvedValue({
			id: "/root/file.txt",
			deleted: true,
		});

		await expect(storage.exists("root/file.txt")).resolves.toBe(false);
	});

	it("returns false when fetchJSON throws", async () => {
		asMock(fetchJSON).mockRejectedValue(new Error("network error"));

		await expect(storage.exists("root/file.txt")).resolves.toBe(false);
	});

	it("recursively deletes nested folders before marking the root deleted", async () => {
		asMock(fetchJSON).mockImplementation((_url: any, options: any) => {
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

		const deletedIds = asMock(fetchJSON)
			.mock.calls.filter(([, options]: any) => options.method === "PUT")
			.map(([, options]: any) => JSON.parse(options.body)[0].id);
		expect(deletedIds).toEqual(
			expect.arrayContaining([
				"/root/nested/inner.txt",
				"/root/file.txt",
				"/root",
			]),
		);
	});

	it("returns a falsy body when the file exists but has no content", async () => {
		asMock(fetchJSON).mockResolvedValue({ body: "", deleted: false });

		await expect(storage.readFile("root/file.txt")).resolves.toBe("");
	});
});
