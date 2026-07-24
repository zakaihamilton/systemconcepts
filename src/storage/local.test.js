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

	it("preserves strict listings and directory counts", async () => {
		await localStorage.writeFile("/library/a/one.json", "one");
		await localStorage.writeFile("/library/b/two.json", "two");

		await expect(
			localStorage.getListing("/missing", { strict: true }),
		).rejects.toMatchObject({
			code: "ENOENT",
		});
		expect(
			await localStorage.getListing("/library", { useCount: true }),
		).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ name: "a", type: "dir", count: 0 }),
				expect.objectContaining({ name: "b", type: "dir", count: 0 }),
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

	it("deletes a folder tree and reports missing files", async () => {
		await localStorage.writeFile("/cache/a.json", "a");
		await localStorage.writeFile("/cache/nested/b.json", "b");

		await localStorage.deleteFolder("/cache");

		expect(await localStorage.exists("/cache")).toBe(false);
		expect(await localStorage.readFile("/cache/a.json")).toBeNull();
		await expect(
			localStorage.deleteFile("/cache/a.json"),
		).rejects.toMatchObject({
			code: "ENOENT",
		});
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
				storage: { estimate: jest.fn().mockResolvedValue({ usage: 42 }) },
			},
		});
		try {
			expect(await localStorage.getSize()).toBe(42);
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
