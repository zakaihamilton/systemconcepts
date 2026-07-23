import { logger as structuredLogger } from "@util/api/logger";

jest.mock("@util/api/logger", () => ({
	logger: { debug: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const mockFsPromises = {
	readdir: jest.fn(),
	stat: jest.fn(),
	mkdir: jest.fn(),
	rmdir: jest.fn(),
	unlink: jest.fn(),
	rename: jest.fn(),
	readFile: jest.fn(),
	writeFile: jest.fn(),
};

jest.mock("@isomorphic-git/lightning-fs", () =>
	jest.fn().mockImplementation(() => ({ promises: mockFsPromises })),
);

let localStorage;
let clear;
let resetLocalFileSystem;
const originalProcessBrowser = process.browser;

beforeAll(() => {
	process.browser = true;
	// eslint-disable-next-line global-require
	const mod = require("@storage/local");
	localStorage = mod.default;
	clear = mod.clear;
	resetLocalFileSystem = mod.resetLocalFileSystem;
});

afterAll(() => {
	process.browser = originalProcessBrowser;
});

beforeEach(() => {
	jest.clearAllMocks();
	Object.values(mockFsPromises).forEach((fn) => fn.mockReset());
});

describe("getListing", () => {
	it("returns an empty array when the directory does not exist", async () => {
		mockFsPromises.readdir.mockRejectedValue(
			Object.assign(new Error("missing"), { code: "ENOENT" }),
		);

		await expect(localStorage.getListing("/missing")).resolves.toEqual([]);
	});

	it("throws in strict mode for non-ENOENT readdir errors", async () => {
		const err = Object.assign(new Error("boom"), { code: "EACCES" });
		mockFsPromises.readdir.mockRejectedValue(err);

		await expect(
			localStorage.getListing("/root", { strict: true }),
		).rejects.toBe(err);
	});

	it("lists files and directories with normalized stats", async () => {
		mockFsPromises.readdir.mockResolvedValueOnce(["file.txt", "sub"]);
		mockFsPromises.stat.mockImplementation((path) => {
			if (path === "/root/file.txt") {
				return Promise.resolve({ type: "file", mtimeMs: 100 });
			}
			if (path === "/root/sub") {
				return Promise.resolve({ type: "dir", mtimeMs: 200 });
			}
			return Promise.resolve({ type: "file" });
		});

		const items = await localStorage.getListing("/root");

		expect(items).toHaveLength(2);
		const file = items.find((item) => item.name === "file.txt");
		const dir = items.find((item) => item.name === "sub");
		expect(file.type).toBe("file");
		expect(file.id).toBe("/local/root/file.txt");
		expect(dir.type).toBe("dir");
		expect(dir.path).toBe("/local/root/sub");
	});

	it("derives mtimeMs from a Date-like mtime", async () => {
		mockFsPromises.readdir.mockResolvedValueOnce(["file.txt"]);
		const mtime = { getTime: () => 12345 };
		mockFsPromises.stat.mockResolvedValue({ type: "file", mtime });

		const [item] = await localStorage.getListing("/root");

		expect(item.mtimeMs).toBe(12345);
	});

	it("derives mtimeMs from a numeric mtime and defaults to zero otherwise", async () => {
		mockFsPromises.readdir.mockResolvedValueOnce(["a.txt", "b.txt"]);
		mockFsPromises.stat.mockImplementation((path) => {
			if (path === "/root/a.txt") {
				return Promise.resolve({ type: "file", mtime: 999 });
			}
			return Promise.resolve({ type: "file" });
		});

		const items = await localStorage.getListing("/root");

		expect(items.find((i) => i.name === "a.txt").mtimeMs).toBe(999);
		expect(items.find((i) => i.name === "b.txt").mtimeMs).toBe(0);
	});

	it("uses isDirectory() when the type field is absent", async () => {
		mockFsPromises.readdir.mockResolvedValueOnce(["sub"]);
		mockFsPromises.stat.mockResolvedValue({
			isDirectory: () => true,
			mtimeMs: 1,
		});

		const [item] = await localStorage.getListing("/root");

		expect(item.type).toBe("dir");
	});

	it("counts child directories when useCount is requested", async () => {
		mockFsPromises.readdir.mockImplementation((path) => {
			if (path === "/root") return Promise.resolve(["sub"]);
			if (path === "/root/sub") return Promise.resolve(["a", "b", "c"]);
			return Promise.resolve([]);
		});
		mockFsPromises.stat.mockImplementation((path) => {
			if (path === "/root/sub") return Promise.resolve({ type: "dir" });
			if (path === "/root/sub/a") return Promise.resolve({ type: "dir" });
			if (path === "/root/sub/b") return Promise.resolve({ type: "file" });
			if (path === "/root/sub/c") return Promise.resolve({ type: "dir" });
			return Promise.resolve({ type: "file" });
		});

		const [item] = await localStorage.getListing("/root", { useCount: true });

		expect(item.count).toBe(2);
	});

	it("swallows per-item stat errors unless strict", async () => {
		mockFsPromises.readdir.mockResolvedValueOnce(["broken.txt"]);
		const err = new Error("stat failed");
		mockFsPromises.stat.mockRejectedValue(err);

		const items = await localStorage.getListing("/root");

		expect(items).toEqual([]);
		expect(structuredLogger.error).toHaveBeenCalledWith(err);
	});

	it("throws per-item stat errors when strict", async () => {
		mockFsPromises.readdir.mockResolvedValueOnce(["broken.txt"]);
		const err = new Error("stat failed");
		mockFsPromises.stat.mockRejectedValue(err);

		await expect(
			localStorage.getListing("/root", { strict: true }),
		).rejects.toBe(err);
	});
});

describe("createFolder", () => {
	it("creates the folder when it does not already exist", async () => {
		mockFsPromises.stat.mockRejectedValue(new Error("missing"));
		mockFsPromises.mkdir.mockResolvedValue(undefined);

		await localStorage.createFolder("/root/new");

		expect(mockFsPromises.mkdir).toHaveBeenCalledWith("/root/new");
	});

	it("does not create the folder when it already exists", async () => {
		mockFsPromises.stat.mockResolvedValue({ type: "dir" });

		await localStorage.createFolder("/root/existing");

		expect(mockFsPromises.mkdir).not.toHaveBeenCalled();
	});

	it("ignores EEXIST errors", async () => {
		mockFsPromises.stat.mockRejectedValue(new Error("missing"));
		mockFsPromises.mkdir.mockRejectedValue(
			Object.assign(new Error("exists"), { code: "EEXIST" }),
		);

		await expect(
			localStorage.createFolder("/root/new"),
		).resolves.toBeUndefined();
	});

	it("re-throws unrelated mkdir errors", async () => {
		mockFsPromises.stat.mockRejectedValue(new Error("missing"));
		const err = Object.assign(new Error("disk full"), { code: "ENOSPC" });
		mockFsPromises.mkdir.mockRejectedValue(err);

		await expect(localStorage.createFolder("/root/new")).rejects.toBe(err);
	});
});

describe("createFolders", () => {
	it("creates every folder under the given prefix", async () => {
		mockFsPromises.stat.mockRejectedValue(new Error("missing"));
		mockFsPromises.mkdir.mockResolvedValue(undefined);

		await localStorage.createFolders("/root/", ["a", "b"]);

		expect(mockFsPromises.mkdir).toHaveBeenCalledWith("/root/a");
		expect(mockFsPromises.mkdir).toHaveBeenCalledWith("/root/b");
	});
});

describe("createFolderPath", () => {
	it("creates only the missing intermediate folders", async () => {
		mockFsPromises.stat.mockImplementation((path) => {
			if (path === "/root") return Promise.resolve({ type: "dir" });
			return Promise.reject(new Error("missing"));
		});
		mockFsPromises.mkdir.mockResolvedValue(undefined);

		await localStorage.createFolderPath("/root/sub/file.txt");

		expect(mockFsPromises.mkdir).toHaveBeenCalledWith("/root/sub");
		expect(mockFsPromises.mkdir).not.toHaveBeenCalledWith("/root");
	});

	it("creates the final segment as a folder when isFolder is true", async () => {
		mockFsPromises.stat.mockRejectedValue(new Error("missing"));
		mockFsPromises.mkdir.mockResolvedValue(undefined);

		await localStorage.createFolderPath("/root/sub", true);

		expect(mockFsPromises.mkdir).toHaveBeenCalledWith("/root/sub");
	});
});

describe("deleteFolder", () => {
	it("returns silently when the folder does not exist", async () => {
		mockFsPromises.readdir.mockRejectedValue(
			Object.assign(new Error("missing"), { code: "ENOENT" }),
		);

		await expect(localStorage.deleteFolder("/root")).resolves.toBeUndefined();
	});

	it("re-throws unexpected readdir errors", async () => {
		const err = Object.assign(new Error("boom"), { code: "EACCES" });
		mockFsPromises.readdir.mockRejectedValue(err);

		await expect(localStorage.deleteFolder("/root")).rejects.toBe(err);
	});

	it("recursively deletes files and subfolders before removing itself", async () => {
		mockFsPromises.readdir.mockImplementation((path) => {
			if (path === "/root") return Promise.resolve(["file.txt", "sub"]);
			if (path === "/root/sub") return Promise.resolve([]);
			return Promise.resolve([]);
		});
		mockFsPromises.stat.mockImplementation((path) => {
			if (path === "/root/sub") return Promise.resolve({ type: "dir" });
			return Promise.resolve({ type: "file" });
		});
		mockFsPromises.unlink.mockResolvedValue(undefined);
		mockFsPromises.rmdir.mockResolvedValue(undefined);

		await localStorage.deleteFolder("/root");

		expect(mockFsPromises.unlink).toHaveBeenCalledWith("/root/file.txt");
		expect(mockFsPromises.rmdir).toHaveBeenCalledWith("/root/sub");
		expect(mockFsPromises.rmdir).toHaveBeenCalledWith("/root");
	});

	it("logs but continues when deleting a child entry fails", async () => {
		mockFsPromises.readdir.mockResolvedValueOnce(["file.txt"]);
		mockFsPromises.stat.mockRejectedValue(
			Object.assign(new Error("gone"), { code: "EACCES" }),
		);
		mockFsPromises.rmdir.mockResolvedValue(undefined);

		await localStorage.deleteFolder("/root");

		expect(structuredLogger.error).toHaveBeenCalled();
		expect(mockFsPromises.rmdir).toHaveBeenCalledWith("/root");
	});

	it("returns when rmdir reports the folder is already gone", async () => {
		mockFsPromises.readdir.mockResolvedValue([]);
		mockFsPromises.rmdir.mockRejectedValue(
			Object.assign(new Error("gone"), { code: "ENOENT" }),
		);

		await expect(localStorage.deleteFolder("/root")).resolves.toBeUndefined();
	});

	it("re-throws unexpected rmdir errors", async () => {
		mockFsPromises.readdir.mockResolvedValue([]);
		const err = Object.assign(new Error("busy"), { code: "EBUSY" });
		mockFsPromises.rmdir.mockRejectedValue(err);

		await expect(localStorage.deleteFolder("/root")).rejects.toBe(err);
	});

	it("retries on ENOTEMPTY and eventually succeeds", async () => {
		jest.useFakeTimers();
		try {
			mockFsPromises.readdir
				.mockResolvedValueOnce([]) // initial children listing
				.mockResolvedValueOnce(["still-here.txt"]) // ENOTEMPTY recheck: not actually empty yet
				.mockResolvedValue([]); // next iteration's children listing
			const notEmptyErr = Object.assign(new Error("not empty"), {
				code: "ENOTEMPTY",
			});
			mockFsPromises.rmdir
				.mockRejectedValueOnce(notEmptyErr)
				.mockResolvedValueOnce(undefined);

			const promise = localStorage.deleteFolder("/root");
			await jest.advanceTimersByTimeAsync(150);
			await promise;

			expect(mockFsPromises.rmdir).toHaveBeenCalledTimes(2);
		} finally {
			jest.useRealTimers();
		}
	});

	it("throws the last ENOTEMPTY error after exhausting retries", async () => {
		jest.useFakeTimers();
		try {
			mockFsPromises.readdir.mockResolvedValue(["stubborn.txt"]);
			mockFsPromises.stat.mockResolvedValue({ type: "file" });
			mockFsPromises.unlink.mockResolvedValue(undefined);
			const notEmptyErr = Object.assign(new Error("not empty"), {
				code: "ENOTEMPTY",
			});
			mockFsPromises.rmdir.mockRejectedValue(notEmptyErr);

			const expectation = expect(
				localStorage.deleteFolder("/root"),
			).rejects.toBe(notEmptyErr);
			await jest.advanceTimersByTimeAsync(2000);
			await expectation;
		} finally {
			jest.useRealTimers();
		}
	});
});

describe("deleteFile", () => {
	it("unlinks the normalized path", async () => {
		mockFsPromises.unlink.mockResolvedValue(undefined);

		await localStorage.deleteFile("root/file.txt");

		expect(mockFsPromises.unlink).toHaveBeenCalledWith("/root/file.txt");
	});
});

describe("rename", () => {
	it("renames via fs.promises.rename", async () => {
		mockFsPromises.rename.mockResolvedValue(undefined);

		await localStorage.rename("root/old.txt", "root/new.txt");

		expect(mockFsPromises.rename).toHaveBeenCalledWith(
			"/root/old.txt",
			"/root/new.txt",
		);
	});
});

describe("readFile", () => {
	it("reads binary files without an encoding argument", async () => {
		mockFsPromises.readFile.mockResolvedValue(Buffer.from("binary"));

		await localStorage.readFile("root/image.png");

		expect(mockFsPromises.readFile).toHaveBeenCalledWith("/root/image.png");
	});

	it("reads text files with utf8 encoding", async () => {
		mockFsPromises.readFile.mockResolvedValue("text");

		const result = await localStorage.readFile("root/file.txt");

		expect(mockFsPromises.readFile).toHaveBeenCalledWith(
			"/root/file.txt",
			"utf8",
		);
		expect(result).toBe("text");
	});

	it("returns null when the file does not exist", async () => {
		mockFsPromises.readFile.mockRejectedValue(
			Object.assign(new Error("missing"), { code: "ENOENT" }),
		);

		await expect(localStorage.readFile("root/missing.txt")).resolves.toBe(null);
	});

	it("re-throws unexpected read errors", async () => {
		const err = Object.assign(new Error("boom"), { code: "EACCES" });
		mockFsPromises.readFile.mockRejectedValue(err);

		await expect(localStorage.readFile("root/file.txt")).rejects.toBe(err);
	});
});

describe("readFiles", () => {
	it("reads every requested file relative to the prefix", async () => {
		mockFsPromises.readFile.mockImplementation((path) =>
			Promise.resolve(`content:${path}`),
		);

		const results = await localStorage.readFiles("root/", ["a.txt", "b.txt"]);

		expect(results).toEqual({
			"a.txt": "content:/root/a.txt",
			"b.txt": "content:/root/b.txt",
		});
	});
});

describe("writeFile", () => {
	it("writes binary files without an encoding argument", async () => {
		await localStorage.writeFile("root/image.png", "data");

		expect(mockFsPromises.writeFile).toHaveBeenCalledWith(
			"/root/image.png",
			"data",
		);
	});

	it("writes text files with utf8 encoding", async () => {
		await localStorage.writeFile("root/file.txt", "data");

		expect(mockFsPromises.writeFile).toHaveBeenCalledWith(
			"/root/file.txt",
			"data",
			"utf8",
		);
	});
});

describe("writeFiles", () => {
	it("writes every file relative to the prefix", async () => {
		await localStorage.writeFiles("root/", {
			"a.txt": "one",
			"b.txt": "two",
		});

		expect(mockFsPromises.writeFile).toHaveBeenCalledWith(
			"/root/a.txt",
			"one",
			"utf8",
		);
		expect(mockFsPromises.writeFile).toHaveBeenCalledWith(
			"/root/b.txt",
			"two",
			"utf8",
		);
	});
});

describe("exists", () => {
	it("resolves true when stat succeeds", async () => {
		mockFsPromises.stat.mockResolvedValue({ type: "file" });

		await expect(localStorage.exists("root/file.txt")).resolves.toBe(true);
	});

	it("resolves false when stat throws", async () => {
		mockFsPromises.stat.mockRejectedValue(new Error("missing"));

		await expect(localStorage.exists("root/missing.txt")).resolves.toBe(false);
	});
});

describe("getSize", () => {
	const originalNavigator = global.navigator;

	afterEach(() => {
		Object.defineProperty(global, "navigator", {
			value: originalNavigator,
			configurable: true,
			writable: true,
		});
	});

	it("returns the storage estimate usage when available", async () => {
		Object.defineProperty(global, "navigator", {
			value: {
				storage: {
					estimate: jest.fn().mockResolvedValue({ usage: 123, quota: 999 }),
				},
			},
			configurable: true,
			writable: true,
		});

		await expect(localStorage.getSize()).resolves.toBe(123);
		expect(structuredLogger.debug).toHaveBeenCalled();
	});

	it("returns zero when storage estimation is unavailable", async () => {
		Object.defineProperty(global, "navigator", {
			value: {},
			configurable: true,
			writable: true,
		});

		await expect(localStorage.getSize()).resolves.toBe(0);
	});
});

describe("getRecursiveList", () => {
	it("flattens nested directories into a single file listing", async () => {
		mockFsPromises.readdir.mockImplementation((path) => {
			if (path === "/root") return Promise.resolve(["file.txt", "sub"]);
			if (path === "/root/sub") return Promise.resolve(["nested.txt"]);
			return Promise.resolve([]);
		});
		mockFsPromises.stat.mockImplementation((path) => {
			if (path === "/root/sub") return Promise.resolve({ type: "dir" });
			return Promise.resolve({ type: "file" });
		});

		const result = await localStorage.getRecursiveList("/root");

		expect(result.map((item) => item.name).sort()).toEqual([
			"file.txt",
			"nested.txt",
		]);
	});
});

describe("clear", () => {
	it("resolves immediately when indexedDB is unavailable", async () => {
		const original = global.indexedDB;
		delete global.indexedDB;

		await expect(clear()).resolves.toBeUndefined();

		global.indexedDB = original;
	});

	it("resolves when the delete request succeeds", async () => {
		const request = {};
		global.indexedDB = {
			deleteDatabase: jest.fn(() => request),
		};

		const promise = clear();
		request.onsuccess();
		await expect(promise).resolves.toBeUndefined();
	});

	it("rejects when the delete request errors", async () => {
		const request = { error: new Error("delete failed") };
		global.indexedDB = {
			deleteDatabase: jest.fn(() => request),
		};

		const promise = clear();
		request.onerror();
		await expect(promise).rejects.toBe(request.error);
	});

	it("resolves when the delete request is blocked", async () => {
		const request = {};
		global.indexedDB = {
			deleteDatabase: jest.fn(() => request),
		};

		const promise = clear();
		request.onblocked();
		await expect(promise).resolves.toBeUndefined();
	});
});

describe("resetLocalFileSystem", () => {
	it("switches all writes to a fresh database before deleting the previous one", async () => {
		const originalIndexedDb = global.indexedDB;
		const request = {};
		global.indexedDB = {
			deleteDatabase: jest.fn(() => request),
		};
		const LightningFS = require("@isomorphic-git/lightning-fs");
		const freshFsPromises = Object.fromEntries(
			Object.keys(mockFsPromises).map((name) => [name, jest.fn()]),
		);
		freshFsPromises.stat.mockResolvedValue({ type: "dir" });
		freshFsPromises.writeFile.mockResolvedValue(undefined);
		LightningFS.mockImplementationOnce(() => ({ promises: freshFsPromises }));
		const initialCalls = LightningFS.mock.calls.length;
		mockFsPromises.writeFile.mockReturnValue(new Promise(() => {}));
		void localStorage.writeFile("old/file.json", "old");

		try {
			const databaseName = await resetLocalFileSystem();

			expect(databaseName).toMatch(/^systemconcepts-fs-/);
			expect(LightningFS).toHaveBeenCalledTimes(initialCalls + 1);
			expect(LightningFS).toHaveBeenLastCalledWith(databaseName);
			expect(freshFsPromises.stat).toHaveBeenCalledWith("/");
			await expect(
				localStorage.writeFile("fresh/file.json", "fresh"),
			).resolves.toBe(undefined);
			expect(freshFsPromises.writeFile).toHaveBeenCalledWith(
				"/fresh/file.json",
				"fresh",
				"utf8",
			);
			expect(window.localStorage.getItem("local_active_database")).toBe(
				databaseName,
			);
			expect(global.indexedDB.deleteDatabase).toHaveBeenCalledTimes(1);
		} finally {
			global.indexedDB = originalIndexedDb;
		}
	});
});
