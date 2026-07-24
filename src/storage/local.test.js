import { deserialize, serialize } from "v8";

if (!global.structuredClone) {
	global.structuredClone = (value) => deserialize(serialize(value));
}

import "fake-indexeddb/auto";

import { logger as structuredLogger } from "@util/api/logger";

jest.mock("@util/api/logger", () => ({
	logger: { debug: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

let localStorage;
let clear;
let resetLocalFileSystem;
const originalProcessBrowser = process.browser;

function openDatabase(name) {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(name);
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}

function readRecord(store, path) {
	return new Promise((resolve, reject) => {
		const request = store.get(path);
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}

beforeAll(() => {
	process.browser = true;
	jest.resetModules();
	// eslint-disable-next-line global-require
	const mod = require("@storage/local");
	localStorage = mod.default;
	clear = mod.clear;
	resetLocalFileSystem = mod.resetLocalFileSystem;
});

afterAll(() => {
	process.browser = originalProcessBrowser;
});

beforeEach(async () => {
	jest.clearAllMocks();
	await resetLocalFileSystem();
});

describe("native IndexedDB local storage", () => {
	it("writes text files, creates parent directories, and lists virtual folders", async () => {
		await localStorage.writeFile("/sync/american/2024.json", '{"sessions":[]}');

		expect(await localStorage.readFile("/sync/american/2024.json")).toBe(
			'{"sessions":[]}',
		);
		expect(await localStorage.exists("/sync")).toBe(true);
		expect(await localStorage.exists("/sync/american")).toBe(true);
		expect(await localStorage.getListing("/sync")).toEqual([
			expect.objectContaining({
				id: "/local/sync/american",
				name: "american",
				path: "/local/sync/american",
				type: "dir",
			}),
		]);
	});

	it("preserves binary file data", async () => {
		const content = new Uint8Array([1, 2, 3, 255]);
		await localStorage.writeFile("/images/test.bin", content);

		const stored = await localStorage.readFile("/images/test.bin");
		expect(Array.from(new Uint8Array(stored))).toEqual([1, 2, 3, 255]);
	});

	it("keeps file bodies out of metadata listings", async () => {
		await localStorage.writeFile("/sync/large.json", "content");
		const database = await openDatabase("systemconcepts-local-files");
		const transaction = database.transaction(["files", "metadata"], "readonly");
		const metadata = await readRecord(
			transaction.objectStore("metadata"),
			"/sync/large.json",
		);
		const file = await readRecord(
			transaction.objectStore("files"),
			"/sync/large.json",
		);
		database.close();

		expect(metadata).not.toHaveProperty("content");
		expect(file).toEqual({ path: "/sync/large.json", content: "content" });
	});

	it("supports explicit empty folders and nested folder creation", async () => {
		await localStorage.createFolderPath("/one/two/three", true);

		expect(await localStorage.exists("/one")).toBe(true);
		expect(await localStorage.exists("/one/two/three")).toBe(true);
		expect(await localStorage.getListing("/one/two")).toEqual([
			expect.objectContaining({ name: "three", type: "dir" }),
		]);
	});

	it("treats root and existing directories as idempotent folder creations", async () => {
		await localStorage.createFolder("/");
		await localStorage.createFolder("/existing");
		await localStorage.createFolder("/existing");
		await localStorage.createFolderPath("/root-file.json");

		expect(await localStorage.exists("/")).toBe(true);
		expect(await localStorage.getListing("/")).toEqual([
			expect.objectContaining({ name: "existing", type: "dir" }),
		]);
	});

	it("rejects folder creation over an existing file and file reads of folders", async () => {
		await localStorage.writeFile("/conflict", "file");
		await localStorage.createFolder("/directory");

		await expect(localStorage.createFolder("/conflict")).rejects.toMatchObject({
			code: "EEXIST",
		});
		await expect(localStorage.readFile("/directory")).rejects.toMatchObject({
			code: "EISDIR",
		});
	});

	it("supports batched folder and file operations", async () => {
		await localStorage.createFolders("/batch", ["one", "two/nested"]);
		await localStorage.writeFiles("/batch", {
			"one/a.json": "a",
			"two/b.json": "b",
		});

		expect(
			await localStorage.readFiles("/batch", [
				"one/a.json",
				"two/b.json",
				"missing.json",
			]),
		).toEqual({
			"one/a.json": "a",
			"two/b.json": "b",
			"missing.json": null,
		});
		expect(await localStorage.exists("/batch/two/nested")).toBe(true);
	});

	it("preserves strict listings and directory counts", async () => {
		await localStorage.writeFile("/library/a/one.json", "one");
		await localStorage.writeFile("/library/a/empty.json", "");
		await localStorage.writeFile("/library/b/two.json", "two");
		await localStorage.createFolder("/library/a/nested");

		await expect(
			localStorage.getListing("/missing", { strict: true }),
		).rejects.toMatchObject({
			code: "ENOENT",
		});
		expect(
			await localStorage.getListing("/library", { useCount: true }),
		).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ name: "a", type: "dir", count: 1 }),
				expect.objectContaining({ name: "b", type: "dir", count: 0 }),
			]),
		);
		expect(await localStorage.getListing("/library/a")).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					name: "one.json",
					type: "file",
					size: 3,
				}),
				expect.objectContaining({
					name: "empty.json",
					type: "file",
					size: 0,
				}),
				expect.objectContaining({ name: "nested", type: "dir" }),
			]),
		);
	});

	it("renames complete folder trees", async () => {
		await localStorage.writeFile("/drafts/a.json", "a");
		await localStorage.writeFile("/drafts/nested/b.json", "b");

		await localStorage.rename("/drafts", "/published");

		expect(await localStorage.readFile("/drafts/a.json")).toBeNull();
		expect(await localStorage.readFile("/published/a.json")).toBe("a");
		expect(await localStorage.readFile("/published/nested/b.json")).toBe("b");
	});

	it("reports a missing rename source", async () => {
		await expect(
			localStorage.rename("/missing", "/destination"),
		).rejects.toMatchObject({ code: "ENOENT" });
	});

	it("deletes a folder tree and reports missing files", async () => {
		await localStorage.writeFile("/cache/a.json", "a");
		await localStorage.writeFile("/cache/nested/b.json", "b");

		await localStorage.deleteFile("/cache/a.json");
		expect(await localStorage.readFile("/cache/a.json")).toBeNull();
		await localStorage.deleteFolder("/cache");

		expect(await localStorage.exists("/cache")).toBe(false);
		expect(await localStorage.readFile("/cache/a.json")).toBeNull();
		await expect(
			localStorage.deleteFile("/cache/a.json"),
		).rejects.toMatchObject({
			code: "ENOENT",
		});
	});

	it("deletes every entry when the root folder is removed", async () => {
		await localStorage.writeFile("/one/a.json", "a");
		await localStorage.writeFile("/two/b.json", "b");

		await localStorage.deleteFolder("/");

		expect(await localStorage.getListing("/")).toEqual([]);
	});

	it("records the byte length of ArrayBuffer and Blob-compatible content", async () => {
		await localStorage.writeFile("/binary/raw.bin", new ArrayBuffer(7));
		await localStorage.writeFile("/binary/blob.bin", new Blob(["hello"]));

		expect(await localStorage.getSize()).toBe(12);
	});

	it("handles sequential writes separated by the old idle timeout", async () => {
		await localStorage.writeFile("/sync/first.json", "first");
		await new Promise((resolve) => setTimeout(resolve, 550));
		await localStorage.writeFile("/sync/second.json", "second");

		expect(await localStorage.readFile("/sync/second.json")).toBe("second");
	});

	it("clears the store for a full sync", async () => {
		await localStorage.writeFile("/sync/data.json", "data");
		const databaseName = await resetLocalFileSystem();

		expect(databaseName).toBe("systemconcepts-local-files");
		expect(await localStorage.getRecursiveList("/")).toEqual([]);
	});

	it("flattens files and folders into a recursive listing", async () => {
		await localStorage.writeFile("/sync/nested/data.json", "data");

		expect(await localStorage.getRecursiveList("/")).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ name: "sync", type: "dir" }),
				expect.objectContaining({ name: "nested", type: "dir" }),
				expect.objectContaining({ name: "data.json", type: "file" }),
			]),
		);
	});

	it("forgets the legacy active LightningFS database during a full sync", async () => {
		window.localStorage.setItem(
			"local_active_database",
			"systemconcepts-fs-old",
		);

		await resetLocalFileSystem();

		expect(window.localStorage.getItem("local_active_database")).toBeNull();
	});

	it("clears safely when requested directly", async () => {
		await localStorage.writeFile("/sync/data.json", "data");
		await clear();

		expect(await localStorage.exists("/sync/data.json")).toBe(false);
	});

	it("uses the browser storage estimate when available", async () => {
		const originalNavigator = global.navigator;
		Object.defineProperty(global, "navigator", {
			configurable: true,
			value: {
				storage: {
					estimate: jest
						.fn()
						.mockResolvedValueOnce({ usage: 42 })
						.mockResolvedValueOnce({}),
				},
			},
		});
		try {
			expect(await localStorage.getSize()).toBe(42);
			expect(await localStorage.getSize()).toBe(0);
		} finally {
			Object.defineProperty(global, "navigator", {
				configurable: true,
				value: originalNavigator,
			});
		}
	});

	it("returns a calculated size when the estimate API is unavailable", async () => {
		await localStorage.writeFile("/sync/data.json", "hello");
		const originalNavigator = global.navigator;
		Object.defineProperty(global, "navigator", {
			configurable: true,
			value: {},
		});
		try {
			expect(await localStorage.getSize()).toBe(5);
		} finally {
			Object.defineProperty(global, "navigator", {
				configurable: true,
				value: originalNavigator,
			});
		}
	});
});

afterAll(() => {
	expect(structuredLogger.error).not.toHaveBeenCalled();
});
