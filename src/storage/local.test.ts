import { deserialize, serialize } from "v8";

if (!global.structuredClone) {
	global.structuredClone = (value) => deserialize(serialize(value));
}

import "fake-indexeddb/auto";

import { logger as structuredLogger } from "@util/api/logger";

jest.mock("@util/api/logger", () => ({
	logger: { debug: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

let localStorage: any;
let clear: any;
let resetLocalFileSystem: any;
const originalProcessBrowser = process.browser;

function openDatabase(name: string): Promise<IDBDatabase> {
	return new Promise<IDBDatabase>((resolve, reject) => {
		const request = indexedDB.open(name);
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}

function readRecord(store: any, path: string): Promise<any> {
	return new Promise<any>((resolve, reject) => {
		const request = store.get(path);
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}

beforeAll(() => {
	Reflect.set(process, "browser", true);
	jest.resetModules();
	// eslint-disable-next-line global-require
	const mod = require("@storage/local");
	localStorage = mod.default;
	clear = mod.clear;
	resetLocalFileSystem = mod.resetLocalFileSystem;
});

afterAll(() => {
	Reflect.set(process, "browser", originalProcessBrowser);
});

beforeEach(async () => {
	jest.clearAllMocks();
	await resetLocalFileSystem();
});

afterEach(async () => {
	await new Promise((resolve) => setTimeout(resolve, 0));
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

		const stored: any = await localStorage.readFile("/images/test.bin");
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
		const databaseName: any = await resetLocalFileSystem();

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

	it("reopens IndexedDB after the page is hidden or frozen on mobile", async () => {
		await localStorage.writeFile("/sync/keep.json", "keep");

		window.dispatchEvent(new Event("pagehide"));
		await localStorage.writeFile("/sync/after-hide.json", "after-hide");

		document.dispatchEvent(new Event("freeze"));
		expect(await localStorage.readFile("/sync/keep.json")).toBe("keep");
		expect(await localStorage.readFile("/sync/after-hide.json")).toBe(
			"after-hide",
		);
	});

	it("does not close IndexedDB synchronously while Chromium freezes the tab", async () => {
		await localStorage.writeFile("/sync/frozen.json", "frozen");
		const closeSpy = jest.spyOn(IDBDatabase.prototype, "close");
		const callsBefore = asMock(closeSpy).mock.calls.length;
		document.dispatchEvent(new Event("freeze"));
		expect(asMock(closeSpy).mock.calls.length).toBe(callsBefore);
		asMock(closeSpy).mockRestore();
		await localStorage.writeFile("/sync/after-freeze.json", "after-freeze");
		expect(await localStorage.readFile("/sync/frozen.json")).toBe("frozen");
	});

	it("reopens IndexedDB after Android Chrome resume and focus events", async () => {
		await localStorage.writeFile("/sync/resume.json", "resume");
		const openSpy = jest.spyOn(indexedDB, "open");
		const callsBefore = asMock(openSpy).mock.calls.length;
		document.dispatchEvent(new Event("resume"));
		window.dispatchEvent(new Event("focus"));
		await localStorage.writeFile("/sync/after-resume.json", "after-resume");
		expect(asMock(openSpy).mock.calls.length).toBeGreaterThan(callsBefore);
		asMock(openSpy).mockRestore();
		expect(await localStorage.readFile("/sync/resume.json")).toBe("resume");
		expect(await localStorage.readFile("/sync/after-resume.json")).toBe(
			"after-resume",
		);
	});

	it("drops a restored back-forward cache connection on pageshow", async () => {
		await localStorage.writeFile("/sync/cached.json", "cached");
		const pageshow = new Event("pageshow");
		Object.defineProperty(pageshow, "persisted", { value: true });
		window.dispatchEvent(pageshow);

		expect(await localStorage.readFile("/sync/cached.json")).toBe("cached");
		await localStorage.writeFile("/sync/resumed.json", "resumed");
		expect(await localStorage.readFile("/sync/resumed.json")).toBe("resumed");
	});

	it("retries when the cached IndexedDB connection is already closing", async () => {
		await localStorage.writeFile("/sync/before.json", "before");
		const originalTransaction = IDBDatabase.prototype.transaction;
		let calls = 0;
		IDBDatabase.prototype.transaction = function transactionWithClosedError(
			...args
		) {
			calls += 1;
			if (calls === 1) {
				const error = new Error("The database connection is closing");
				error.name = "InvalidStateError";
				throw error;
			}
			return originalTransaction.apply(this, args);
		};
		try {
			await localStorage.writeFile("/sync/retry.json", "retry");
			expect(await localStorage.readFile("/sync/retry.json")).toBe("retry");
			expect(await localStorage.readFile("/sync/before.json")).toBe("before");
			expect(calls).toBeGreaterThan(1);
		} finally {
			IDBDatabase.prototype.transaction = originalTransaction;
		}
	});

	it("reopens after IndexedDB asks this connection to close", async () => {
		await localStorage.writeFile("/sync/before-upgrade.json", "before-upgrade");
		await new Promise<void>((resolve, reject) => {
			const request = indexedDB.deleteDatabase("systemconcepts-local-files");
			request.onsuccess = () => resolve();
			request.onerror = () => reject(request.error);
		});

		await localStorage.writeFile("/sync/after-upgrade.json", "after-upgrade");
		expect(await localStorage.readFile("/sync/after-upgrade.json")).toBe(
			"after-upgrade",
		);
	});

	it("retries when a transaction is aborted after the tab is frozen", async () => {
		await localStorage.writeFile("/sync/abort-before.json", "abort-before");
		const originalTransaction = IDBDatabase.prototype.transaction;
		let calls = 0;
		IDBDatabase.prototype.transaction = function transactionWithAbort(...args) {
			calls += 1;
			if (calls === 1) {
				const error = new Error(
					"An internal error was encountered in the Indexed Database server",
				);
				error.name = "AbortError";
				throw error;
			}
			return originalTransaction.apply(this, args);
		};
		try {
			await localStorage.writeFile("/sync/abort-retry.json", "abort-retry");
			expect(await localStorage.readFile("/sync/abort-retry.json")).toBe(
				"abort-retry",
			);
			expect(calls).toBeGreaterThan(1);
		} finally {
			IDBDatabase.prototype.transaction = originalTransaction;
		}
	});
});

afterAll(() => {
	expect(structuredLogger.error).not.toHaveBeenCalled();
});
