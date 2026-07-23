import storageDevices from "@data/storage";
import { act, renderHook, waitFor } from "@testing-library/react";
import { logger as structuredLogger } from "@util/api/logger";
import storage, {
	callMethod,
	useFile,
	useListing,
} from "@util/storage/storage";

jest.mock("@data/storage", () => []);
jest.mock("@util/api/logger", () => ({
	logger: { debug: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

function makeDevice(id, overrides = {}) {
	return {
		id,
		enabled: true,
		getListing: jest.fn().mockResolvedValue([]),
		createFolder: jest.fn().mockResolvedValue(undefined),
		createFolders: jest.fn().mockResolvedValue(undefined),
		createFolderPath: jest.fn().mockResolvedValue(undefined),
		deleteFolder: jest.fn().mockResolvedValue(undefined),
		deleteFolderPath: jest.fn().mockResolvedValue(undefined),
		deleteFile: jest.fn().mockResolvedValue(undefined),
		readFile: jest.fn().mockResolvedValue(null),
		readFiles: jest.fn().mockResolvedValue({}),
		writeFile: jest.fn().mockResolvedValue(undefined),
		writeFiles: jest.fn().mockResolvedValue(undefined),
		exists: jest.fn().mockResolvedValue(false),
		exportFolder: jest.fn().mockResolvedValue({}),
		importFolder: jest.fn().mockResolvedValue(undefined),
		copyFolder: jest.fn().mockResolvedValue(undefined),
		copyFile: jest.fn().mockResolvedValue(undefined),
		getSize: jest.fn().mockResolvedValue(0),
		resetLocalFileSystem: jest.fn().mockResolvedValue(undefined),
		...overrides,
	};
}

beforeEach(() => {
	jest.clearAllMocks();
	storageDevices.length = 0;
});

describe("callMethod", () => {
	it("dispatches a filesystem reset directly to the local device", async () => {
		const device = makeDevice("local");
		storageDevices.push(device);

		await storage.resetLocalFileSystem();

		expect(device.resetLocalFileSystem).toHaveBeenCalledWith("/");
	});

	it("returns null when the device is not found", async () => {
		await expect(
			callMethod({ name: "readFile" }, "missing/file"),
		).resolves.toBe(null);
	});

	it("returns null when the device does not implement the method", async () => {
		const device = makeDevice("local");
		delete device.getSize;
		storageDevices.push(device);
		await expect(callMethod({ name: "getSize" }, "local/file")).resolves.toBe(
			null,
		);
	});

	it("dispatches simple methods to the matching device with a normalized path", async () => {
		const device = makeDevice("local");
		device.readFile.mockResolvedValue("hello");
		storageDevices.push(device);

		const result = await callMethod({ name: "readFile" }, "local/a/b.txt");

		expect(device.readFile).toHaveBeenCalledWith("/a/b.txt");
		expect(result).toBe("hello");
	});

	it("maps 'path' typed params by stripping the device prefix", async () => {
		const device = makeDevice("local");
		storageDevices.push(device);

		await callMethod(
			{ name: "copyFile", types: ["path"] },
			"local/from.txt",
			"local/to.txt",
		);

		expect(device.copyFile).toHaveBeenCalledWith("/from.txt", "/to.txt");
	});

	it("re-throws non-filesystem errors and logs them", async () => {
		const device = makeDevice("local");
		const err = new Error("boom");
		device.readFile.mockRejectedValue(err);
		storageDevices.push(device);

		await expect(callMethod({ name: "readFile" }, "local/a.txt")).rejects.toBe(
			err,
		);
		expect(structuredLogger.error).toHaveBeenCalledWith(err);
	});

	it.each([
		"ENOENT",
		"EEXIST",
		"EISDIR",
		"ENOTDIR",
	])("suppresses logging for common filesystem error %s", async (code) => {
		const device = makeDevice("local");
		const err = Object.assign(new Error("fs error"), { code });
		device.readFile.mockRejectedValue(err);
		storageDevices.push(device);

		await expect(callMethod({ name: "readFile" }, "local/a.txt")).rejects.toBe(
			err,
		);
		expect(structuredLogger.error).not.toHaveBeenCalled();
	});

	describe("getListing without a device id", () => {
		it("returns an entry per enabled device", async () => {
			storageDevices.push(makeDevice("local"));
			storageDevices.push(makeDevice("aws", { enabled: false }));
			storageDevices.push(makeDevice("wasabi", { enabled: () => false }));
			storageDevices.push(makeDevice("remote", { enabled: () => true }));

			const results = await callMethod({ name: "getListing" }, "");

			expect(results).toHaveLength(2);
			expect(results.map((r) => r.id).sort()).toEqual(["local", "remote"]);
		});

		it("includes counts when useCount is requested", async () => {
			const device = makeDevice("local");
			device.getListing.mockResolvedValue([{ name: "a" }, { name: "b" }]);
			storageDevices.push(device);

			const [result] = await callMethod({ name: "getListing" }, "", {
				useCount: true,
			});

			expect(result.count).toBe(2);
		});

		it("sums recursive sizes for the local device when useSize is requested", async () => {
			const device = makeDevice("local", {
				getRecursiveList: jest
					.fn()
					.mockResolvedValue([{ size: 10 }, { size: 5 }]),
			});
			storageDevices.push(device);

			const [result] = await callMethod({ name: "getListing" }, "", {
				useSize: true,
			});

			expect(result.size).toBe(15);
		});

		it("falls back to zero and logs when computing local size throws", async () => {
			const device = makeDevice("local", {
				getRecursiveList: jest.fn().mockRejectedValue(new Error("fail")),
			});
			device.getListing.mockRejectedValue(new Error("also fails"));
			storageDevices.push(device);

			const [result] = await callMethod({ name: "getListing" }, "", {
				useSize: true,
			});

			expect(result.size).toBe(0);
			expect(structuredLogger.error).toHaveBeenCalled();
		});

		it("uses the device getSize method for non-local devices", async () => {
			const device = makeDevice("aws", {
				getSize: jest.fn().mockResolvedValue(42),
			});
			storageDevices.push(device);

			const [result] = await callMethod({ name: "getListing" }, "", {
				useSize: true,
			});

			expect(result.size).toBe(42);
			expect(device.getSize).toHaveBeenCalled();
		});

		it("skips size computation when a device has no getSize method", async () => {
			const device = makeDevice("aws");
			delete device.getSize;
			storageDevices.push(device);

			const [result] = await callMethod({ name: "getListing" }, "", {
				useSize: true,
			});

			expect(result.size).toBeUndefined();
		});
	});

	describe("getListing with a device id", () => {
		it("computes recursive directory sizes for the local device", async () => {
			const device = makeDevice("local");
			device.getListing.mockResolvedValueOnce([
				{
					name: "sub",
					type: "dir",
					path: "/local/root/sub",
					id: "/local/root/sub",
				},
			]);
			device.getRecursiveList = jest
				.fn()
				.mockResolvedValue([{ size: 3 }, { size: 4 }]);
			storageDevices.push(device);

			const items = await callMethod({ name: "getListing" }, "local/root", {
				useSize: true,
			});

			expect(items[0].size).toBe(7);
		});

		it("defaults the directory size to zero when recursion yields nothing", async () => {
			const device = makeDevice("local");
			device.getListing
				.mockResolvedValueOnce([
					{
						name: "sub",
						type: "dir",
						path: "/local/root/sub",
						id: "/local/root/sub",
					},
				])
				.mockResolvedValue([]);
			storageDevices.push(device);

			const items = await callMethod({ name: "getListing" }, "local/root", {
				useSize: true,
			});

			expect(items[0].size).toBe(0);
		});

		it("does not compute sizes for non-local devices", async () => {
			const device = makeDevice("aws");
			device.getListing.mockResolvedValue([
				{ name: "sub", type: "dir", path: "/aws/root/sub" },
			]);
			storageDevices.push(device);

			const items = await callMethod({ name: "getListing" }, "aws/root", {
				useSize: true,
			});

			expect(items[0].size).toBeUndefined();
		});
	});
});

describe("storage.getRecursiveList", () => {
	it("uses the device recursive method when available", async () => {
		const device = makeDevice("local", {
			getRecursiveList: jest.fn().mockResolvedValue([{ name: "a" }]),
		});
		storageDevices.push(device);

		const result = await storage.getRecursiveList("local/root");

		expect(result).toEqual([{ name: "a" }]);
	});

	it("falls back to manual recursion when the device method is unsupported", async () => {
		const device = makeDevice("local");
		delete device.getRecursiveList;
		device.getListing.mockImplementation((path) => {
			if (path === "/root") {
				return Promise.resolve([
					{ name: "file.txt", type: "file", path: "/local/root/file.txt" },
					{ name: "sub", type: "dir", path: "/local/root/sub" },
				]);
			}
			if (path === "/root/sub") {
				return Promise.resolve([
					{
						name: "nested.txt",
						type: "file",
						path: "/local/root/sub/nested.txt",
					},
				]);
			}
			return Promise.resolve([]);
		});
		storageDevices.push(device);

		const result = await storage.getRecursiveList("local/root");

		expect(result.map((item) => item.name).sort()).toEqual([
			"file.txt",
			"nested.txt",
		]);
	});

	it("falls back to manual recursion when the device method rejects", async () => {
		const device = makeDevice("local", {
			getRecursiveList: jest.fn().mockRejectedValue(new Error("unsupported")),
		});
		device.getListing.mockResolvedValue([]);
		storageDevices.push(device);

		const result = await storage.getRecursiveList("local/root");

		expect(result).toEqual([]);
		expect(structuredLogger.warn).toHaveBeenCalled();
	});

	it("propagates errors in strict mode when the device method rejects", async () => {
		const err = new Error("unsupported");
		const device = makeDevice("local", {
			getRecursiveList: jest.fn().mockRejectedValue(err),
		});
		storageDevices.push(device);

		await expect(
			storage.getRecursiveList("local/root", { strict: true }),
		).rejects.toBe(err);
	});

	it("stops recursing once the maximum depth is exceeded", async () => {
		const device = makeDevice("local");
		delete device.getRecursiveList;
		let depth = 0;
		device.getListing.mockImplementation((path) => {
			depth += 1;
			const name = `d${depth}`;
			return Promise.resolve([
				{ name, type: "dir", path: `${path}/${name}`.replace("//", "/") },
			]);
		});
		storageDevices.push(device);

		const result = await storage.getRecursiveList("local/root");

		expect(result).toEqual([]);
		expect(structuredLogger.warn).toHaveBeenCalled();
	});

	it("avoids revisiting the same directory twice", async () => {
		const device = makeDevice("local");
		delete device.getRecursiveList;
		device.getListing.mockImplementation((path) => {
			if (path === "/root") {
				return Promise.resolve([
					{ name: "sub", type: "dir", path: "/local/root/sub" },
					{ name: "sub2", type: "dir", path: "/local/root/sub" },
				]);
			}
			return Promise.resolve([]);
		});
		storageDevices.push(device);

		const result = await storage.getRecursiveList("local/root");

		expect(result).toEqual([]);
		expect(device.getListing).toHaveBeenCalledTimes(2);
	});

	it("skips entries whose path does not belong to the directory", async () => {
		const device = makeDevice("local");
		delete device.getRecursiveList;
		device.getListing.mockResolvedValue([
			{
				name: "escaped.txt",
				type: "file",
				path: "/local/elsewhere/escaped.txt",
			},
		]);
		storageDevices.push(device);

		const result = await storage.getRecursiveList("local/root");

		expect(result).toEqual([]);
		expect(structuredLogger.warn).toHaveBeenCalled();
	});

	it("throws in strict mode when listing depth is exceeded", async () => {
		const device = makeDevice("local");
		delete device.getRecursiveList;
		let depth = 0;
		device.getListing.mockImplementation(() => {
			depth += 1;
			const name = `d${depth}`;
			return Promise.resolve([
				{
					name,
					type: "dir",
					path: `/local/root/${name}`,
				},
			]);
		});
		storageDevices.push(device);

		await expect(
			storage.getRecursiveList("local/root", { strict: true }),
		).rejects.toThrow(/Storage listing depth exceeded|invalid entries/);
	});

	it("throws in strict mode when some entries fail path validation", async () => {
		const device = makeDevice("local");
		delete device.getRecursiveList;
		device.getListing.mockResolvedValue([
			{ name: "good.txt", type: "file", path: "/local/root/good.txt" },
			{ name: "bad.txt", type: "file", path: "/local/elsewhere/bad.txt" },
		]);
		storageDevices.push(device);

		await expect(
			storage.getRecursiveList("local/root", { strict: true }),
		).rejects.toThrow("Storage returned invalid entries");
	});
});

describe("storage.exportFolder", () => {
	it("builds a nested data object from files and folders, skipping binaries", async () => {
		const device = makeDevice("local");
		delete device.getRecursiveList;
		device.getListing.mockImplementation((path) => {
			if (path === "/root") {
				return Promise.resolve([
					{ name: "file.txt", type: "file", path: "local/root/file.txt" },
					{ name: "image.png", type: "file", path: "local/root/image.png" },
					{ name: "sub", type: "dir", path: "local/root/sub" },
				]);
			}
			if (path === "/root/sub") {
				return Promise.resolve([
					{
						name: "nested.txt",
						type: "file",
						path: "local/root/sub/nested.txt",
					},
				]);
			}
			return Promise.resolve([]);
		});
		device.readFile.mockImplementation((path) => {
			if (path === "/root/file.txt") return Promise.resolve("hello");
			if (path === "/root/sub/nested.txt") return Promise.resolve("world");
			return Promise.resolve(null);
		});
		storageDevices.push(device);

		const data = await storage.exportFolder("local/root");

		expect(data).toEqual({
			"file.txt": "hello",
			sub: { "nested.txt": "world" },
		});
		expect(device.readFile).not.toHaveBeenCalledWith("/root/image.png");
	});

	it("logs and continues when a nested item fails to read", async () => {
		const device = makeDevice("local");
		device.getListing.mockResolvedValueOnce([
			{ name: "broken.txt", type: "file", path: "local/root/broken.txt" },
		]);
		device.readFile.mockRejectedValue(new Error("read failed"));
		storageDevices.push(device);

		const data = await storage.exportFolder("local/root");

		expect(data).toEqual({});
		expect(structuredLogger.error).toHaveBeenCalled();
	});
});

describe("storage.exportFolderAsZip", () => {
	it("builds a zip blob containing nested files", async () => {
		const device = makeDevice("local");
		device.getListing.mockImplementation((path) => {
			if (path === "/root") {
				return Promise.resolve([
					{ name: "file.txt", type: "file", path: "local/root/file.txt" },
					{ name: "sub", type: "dir", path: "local/root/sub" },
				]);
			}
			if (path === "/root/sub") {
				return Promise.resolve([
					{
						name: "nested.txt",
						type: "file",
						path: "local/root/sub/nested.txt",
					},
				]);
			}
			return Promise.resolve([]);
		});
		device.readFile.mockImplementation((path) => {
			if (path === "/root/file.txt") return Promise.resolve("hello");
			if (path === "/root/sub/nested.txt") return Promise.resolve("world");
			return Promise.resolve(null);
		});
		storageDevices.push(device);

		const blob = await storage.exportFolderAsZip("local/root");

		expect(blob).toBeDefined();
		expect(blob.size).toBeGreaterThan(0);
	});

	it("stores binary files as base64 strings in the zip", async () => {
		const device = makeDevice("local");
		device.getListing.mockResolvedValue([
			{ name: "photo.png", type: "file", path: "local/root/photo.png" },
		]);
		device.readFile.mockResolvedValue("aGVsbG8=");
		storageDevices.push(device);

		const blob = await storage.exportFolderAsZip("local/root");

		expect(blob).toBeDefined();
		expect(blob.size).toBeGreaterThan(0);
	});

	it("logs and continues when a nested item fails while zipping", async () => {
		const device = makeDevice("local");
		device.getListing.mockResolvedValueOnce([
			{ name: "broken.txt", type: "file", path: "local/root/broken.txt" },
		]);
		device.readFile.mockRejectedValue(new Error("read failed"));
		storageDevices.push(device);

		const blob = await storage.exportFolderAsZip("local/root");

		expect(blob).toBeDefined();
		expect(structuredLogger.error).toHaveBeenCalled();
	});

	it("omits files whose content is null when building the zip", async () => {
		const device = makeDevice("local");
		device.getListing.mockResolvedValue([
			{ name: "empty.txt", type: "file", path: "local/root/empty.txt" },
		]);
		device.readFile.mockResolvedValue(null);
		storageDevices.push(device);

		const blob = await storage.exportFolderAsZip("local/root");
		expect(blob).toBeDefined();
	});
});

describe("storage.importFolder", () => {
	it("creates folders and writes files for a nested data object", async () => {
		const device = makeDevice("local");
		storageDevices.push(device);

		await storage.importFolder("local/root", {
			"file.txt": "hello",
			sub: { "nested.txt": "world" },
		});

		expect(device.createFolder).toHaveBeenCalledWith("/root");
		expect(device.createFolder).toHaveBeenCalledWith("/root/sub");
		expect(device.writeFile).toHaveBeenCalledWith("/root/file.txt", "hello");
		expect(device.writeFile).toHaveBeenCalledWith(
			"/root/sub/nested.txt",
			"world",
		);
	});

	it("imports arrays of records keyed by id or name", async () => {
		const device = makeDevice("local");
		storageDevices.push(device);

		await storage.importFolder("local/root", {
			items: [
				{ id: "item-1", "data.txt": "one" },
				{ name: "item-2", "data.txt": "two" },
			],
		});

		expect(device.createFolder).toHaveBeenCalledWith("/root/items/item-1");
		expect(device.createFolder).toHaveBeenCalledWith("/root/items/item-2");
		expect(device.writeFile).toHaveBeenCalledWith(
			"/root/items/item-1/data.txt",
			"one",
		);
		expect(device.writeFile).toHaveBeenCalledWith(
			"/root/items/item-2/data.txt",
			"two",
		);
	});
});

describe("storage.copyFolder / copyFile / moveFolder / moveFile", () => {
	it("does nothing when copying a file to itself", async () => {
		const device = makeDevice("local");
		storageDevices.push(device);

		await storage.copyFile("local/a.txt", "local/a.txt");

		expect(device.readFile).not.toHaveBeenCalled();
		expect(device.writeFile).not.toHaveBeenCalled();
	});

	it("copies file contents from one path to another", async () => {
		const device = makeDevice("local");
		device.readFile.mockResolvedValue("payload");
		storageDevices.push(device);

		await storage.copyFile("local/a.txt", "local/b.txt");

		expect(device.readFile).toHaveBeenCalledWith("/a.txt");
		expect(device.writeFile).toHaveBeenCalledWith("/b.txt", "payload");
	});

	it("does nothing when copying a folder to itself", async () => {
		const device = makeDevice("local");
		storageDevices.push(device);

		await storage.copyFolder("local/a", "local/a");

		expect(device.getListing).not.toHaveBeenCalled();
	});

	it("recursively copies folders and files", async () => {
		const device = makeDevice("local");
		device.getListing.mockImplementation((path) => {
			if (path === "/from") {
				return Promise.resolve([
					{ name: "file.txt", type: "file" },
					{ name: "sub", type: "dir" },
				]);
			}
			return Promise.resolve([]);
		});
		device.readFile.mockResolvedValue("contents");
		storageDevices.push(device);

		await storage.copyFolder("local/from", "local/to");

		expect(device.createFolderPath).toHaveBeenCalledWith("/to", true);
		expect(device.readFile).toHaveBeenCalledWith("/from/file.txt");
		expect(device.writeFile).toHaveBeenCalledWith("/to/file.txt", "contents");
	});

	it("moves a file by copying then deleting the source", async () => {
		const device = makeDevice("local");
		device.readFile.mockResolvedValue("payload");
		storageDevices.push(device);

		await storage.moveFile("local/a.txt", "local/b.txt");

		expect(device.writeFile).toHaveBeenCalledWith("/b.txt", "payload");
		expect(device.deleteFile).toHaveBeenCalledWith("/a.txt");
	});

	it("does nothing when moving a file to itself", async () => {
		const device = makeDevice("local");
		storageDevices.push(device);

		await storage.moveFile("local/a.txt", "local/a.txt");

		expect(device.deleteFile).not.toHaveBeenCalled();
	});

	it("moves a folder by copying then deleting the source", async () => {
		const device = makeDevice("local");
		device.getListing.mockResolvedValue([]);
		storageDevices.push(device);

		await storage.moveFolder("local/from", "local/to");

		expect(device.createFolderPath).toHaveBeenCalledWith("/to", true);
		expect(device.deleteFolder).toHaveBeenCalledWith("/from");
	});

	it("does nothing when moving a folder to itself", async () => {
		const device = makeDevice("local");
		storageDevices.push(device);

		await storage.moveFolder("local/from", "local/from");

		expect(device.deleteFolder).not.toHaveBeenCalled();
	});
});

describe("useListing", () => {
	it("ignores stale responses when the url changes before fetch completes", async () => {
		const device = makeDevice("local");
		let resolveSlow;
		device.getListing.mockImplementation((path) => {
			if (path === "/slow") {
				return new Promise((resolve) => {
					resolveSlow = resolve;
				});
			}
			return Promise.resolve([{ name: "fresh" }]);
		});
		storageDevices.push(device);

		const { result, rerender } = renderHook(({ url }) => useListing(url), {
			initialProps: { url: "local/slow" },
		});

		rerender({ url: "local/fast" });
		await waitFor(() => expect(result.current[0]).toEqual([{ name: "fresh" }]));

		await act(async () => {
			resolveSlow([{ name: "stale" }]);
			await Promise.resolve();
		});

		expect(result.current[0]).toEqual([{ name: "fresh" }]);
	});

	it("loads a listing and reports loading transitions", async () => {
		const device = makeDevice("local");
		device.getListing.mockResolvedValue([{ name: "a" }]);
		storageDevices.push(device);

		const { result } = renderHook(() => useListing("local/root"));

		await waitFor(() => expect(result.current[1]).toBe(false));
		expect(result.current[0]).toEqual([{ name: "a" }]);
		expect(result.current[2]).toBe(null);
	});

	it("surfaces errors from the storage layer", async () => {
		const device = makeDevice("local");
		const err = new Error("listing failed");
		device.getListing.mockRejectedValue(err);
		storageDevices.push(device);

		const { result } = renderHook(() => useListing("local/root"));

		await waitFor(() => expect(result.current[2]).toBe(err));
		expect(result.current[1]).toBe(false);
	});

	it("does not replace listing state when the fetched listing is unchanged", async () => {
		const device = makeDevice("local");
		const listing = [{ name: "a" }];
		device.getListing.mockResolvedValue(listing);
		storageDevices.push(device);

		const { result } = renderHook(() => useListing("local/root"));
		await waitFor(() => expect(result.current[1]).toBe(false));
		expect(result.current[0]).toBe(listing);
	});
});

describe("useFile", () => {
	it("resolves to null data when the file does not exist", async () => {
		const device = makeDevice("local");
		device.exists.mockResolvedValue(false);
		storageDevices.push(device);

		const { result } = renderHook(() => useFile("local/missing.json"));

		await waitFor(() => expect(result.current[1]).toBe(false));
		expect(result.current[0]).toBe(null);
	});

	it("applies a mapping function to loaded data", async () => {
		const device = makeDevice("local");
		device.exists.mockResolvedValue(true);
		device.readFile.mockResolvedValue("42");
		storageDevices.push(device);

		const { result } = renderHook(() =>
			useFile("local/data.json", [], (data) => data && Number(data)),
		);

		await waitFor(() => expect(result.current[1]).toBe(false));
		expect(result.current[0]).toBe(42);
	});

	it("surfaces read errors", async () => {
		const device = makeDevice("local");
		device.exists.mockResolvedValue(true);
		const err = new Error("read failed");
		// Reject on a later macrotask so it settles after the hook's own
		// error-reset timer (scheduled with setTimeout(0)) has already run.
		device.readFile.mockImplementation(
			() => new Promise((_resolve, reject) => setTimeout(() => reject(err), 5)),
		);
		storageDevices.push(device);

		const { result } = renderHook(() => useFile("local/data.json"));

		await waitFor(() => expect(result.current[2]).toBe(err));
	});

	it("surfaces existence-check errors", async () => {
		const device = makeDevice("local");
		const err = new Error("exists failed");
		device.exists.mockImplementation(
			() => new Promise((_resolve, reject) => setTimeout(() => reject(err), 5)),
		);
		storageDevices.push(device);

		const { result } = renderHook(() => useFile("local/data.json"));

		await waitFor(() => expect(result.current[2]).toBe(err));
	});

	it("writes string data to storage and updates local state", async () => {
		const device = makeDevice("local");
		device.exists.mockResolvedValue(false);
		storageDevices.push(device);

		const { result } = renderHook(() => useFile("local/data.json"));
		await waitFor(() => expect(result.current[1]).toBe(false));

		await act(async () => {
			await result.current[3]("hello");
		});

		expect(device.createFolderPath).toHaveBeenCalledWith("/data.json");
		expect(device.writeFile).toHaveBeenCalledWith("/data.json", "hello");
		expect(result.current[0]).toBe("hello");
	});

	it("serializes non-string data before writing", async () => {
		const device = makeDevice("local");
		device.exists.mockResolvedValue(false);
		storageDevices.push(device);

		const { result } = renderHook(() => useFile("local/data.json"));
		await waitFor(() => expect(result.current[1]).toBe(false));

		await act(async () => {
			await result.current[3]({ a: 1 });
		});

		expect(device.writeFile).toHaveBeenCalledWith(
			"/data.json",
			JSON.stringify({ a: 1 }, null, 4),
		);
	});

	it("leaves non-path typed params unchanged", async () => {
		const device = makeDevice("local");
		storageDevices.push(device);

		await callMethod(
			{ name: "copyFile", types: ["path", "string"] },
			"local/from.txt",
			"local/to.txt",
			"extra",
		);

		expect(device.copyFile).toHaveBeenCalledWith(
			"/from.txt",
			"/to.txt",
			"extra",
		);
	});

	it("sets directory size to zero when recursive listing throws", async () => {
		const device = makeDevice("local");
		device.getListing.mockResolvedValueOnce([
			{
				name: "sub",
				type: "dir",
				path: "/local/root/sub",
				id: "/local/root/sub",
			},
		]);
		jest
			.spyOn(storage, "getRecursiveList")
			.mockRejectedValueOnce(new Error("boom"));
		storageDevices.push(device);

		const items = await callMethod({ name: "getListing" }, "local/root", {
			useSize: true,
		});

		expect(items[0].size).toBe(0);
		storage.getRecursiveList.mockRestore();
	});

	it("supports a functional updater that reads previous state", async () => {
		const device = makeDevice("local");
		device.exists.mockResolvedValue(true);
		device.readFile.mockResolvedValue("1");
		storageDevices.push(device);

		const { result } = renderHook(() =>
			useFile("local/data.json", [], (data) => Number(data)),
		);
		await waitFor(() => expect(result.current[1]).toBe(false));
		expect(result.current[0]).toBe(1);

		await act(async () => {
			await result.current[3]((prev) => (prev || 0) + 1);
		});

		expect(device.writeFile).toHaveBeenCalledWith("/data.json", "2");
		expect(result.current[0]).toBe(2);
	});

	it("writes string data returned from a functional updater without re-serializing", async () => {
		const device = makeDevice("local");
		device.exists.mockResolvedValue(true);
		device.readFile.mockResolvedValue("seed");
		storageDevices.push(device);

		const { result } = renderHook(() => useFile("local/data.json"));
		await waitFor(() => expect(result.current[1]).toBe(false));

		await act(async () => {
			await result.current[3](() => "plain-string");
		});

		expect(device.writeFile).toHaveBeenCalledWith("/data.json", "plain-string");
	});

	it("applies mapping when the file does not exist", async () => {
		const device = makeDevice("local");
		device.exists.mockResolvedValue(false);
		storageDevices.push(device);
		const mapping = jest.fn((_data, url) => ({ fromMapping: url }));

		const { result } = renderHook(() => useFile("local/new.json", [], mapping));
		await waitFor(() => expect(result.current[1]).toBe(false));

		expect(mapping).toHaveBeenCalledWith(null, "/local/new.json");
		expect(result.current[0]).toEqual({ fromMapping: "/local/new.json" });
	});

	it("returns undefined data and skips fetching when no url is provided", async () => {
		const { result } = renderHook(() => useFile(undefined));

		await waitFor(() => expect(result.current).toBeDefined());
		expect(result.current[0]).toBeUndefined();
	});

	it("serializes objects returned from a functional updater", async () => {
		const device = makeDevice("local");
		device.exists.mockResolvedValue(true);
		device.readFile.mockResolvedValue("{}");
		storageDevices.push(device);

		const { result } = renderHook(() =>
			useFile("local/data.json", [], (data) => JSON.parse(data || "{}")),
		);
		await waitFor(() => expect(result.current[1]).toBe(false));

		await act(async () => {
			await result.current[3](() => ({ nested: true }));
		});

		expect(device.writeFile).toHaveBeenCalledWith(
			"/data.json",
			JSON.stringify({ nested: true }, null, 4),
		);
	});
});

describe("callMethod edge cases", () => {
	it("defaults url to empty string when omitted", async () => {
		storageDevices.push(makeDevice("local"));
		const results = await callMethod({ name: "getListing" });
		expect(results).toHaveLength(1);
	});

	it("counts zero items when getListing returns null", async () => {
		const device = makeDevice("local");
		device.getListing.mockResolvedValue(null);
		storageDevices.push(device);

		const [result] = await callMethod({ name: "getListing" }, "", {
			useCount: true,
		});

		expect(result.count).toBe(0);
	});

	it("treats missing recursive item sizes as zero", async () => {
		const device = makeDevice("local", {
			getRecursiveList: jest
				.fn()
				.mockResolvedValue([{ size: 5 }, { name: "no-size" }]),
		});
		storageDevices.push(device);

		const [result] = await callMethod({ name: "getListing" }, "", {
			useSize: true,
		});

		expect(result.size).toBe(5);
	});
});

describe("getRecursiveList manual fallback branches", () => {
	it("warns and skips directories when listing throws in fallback mode", async () => {
		const device = makeDevice("local");
		delete device.getRecursiveList;
		device.getListing.mockRejectedValue(new Error("list failed"));
		storageDevices.push(device);

		const result = await storage.getRecursiveList("local/root");

		expect(result).toEqual([]);
		expect(structuredLogger.warn).toHaveBeenCalled();
	});

	it("skips items without paths during manual recursion", async () => {
		const device = makeDevice("local");
		delete device.getRecursiveList;
		device.getListing.mockResolvedValue([{ name: "orphan.txt", type: "file" }]);
		storageDevices.push(device);

		const result = await storage.getRecursiveList("local/root");

		expect(result).toEqual([]);
		expect(structuredLogger.warn).toHaveBeenCalled();
	});

	it("warns when every entry fails path validation in non-strict mode", async () => {
		const device = makeDevice("local");
		delete device.getRecursiveList;
		device.getListing.mockResolvedValue([
			{
				name: "escaped.txt",
				type: "file",
				path: "/local/elsewhere/escaped.txt",
			},
		]);
		storageDevices.push(device);

		const result = await storage.getRecursiveList("local/root");

		expect(result).toEqual([]);
		expect(structuredLogger.warn).toHaveBeenCalledWith(
			expect.stringContaining("don't match expected path prefix"),
		);
	});
});

describe("useListing duplicate responses", () => {
	it("keeps the same listing reference when data is unchanged", async () => {
		const device = makeDevice("local");
		const listing = [{ name: "a" }];
		device.getListing.mockResolvedValue(listing);
		storageDevices.push(device);

		const { result, rerender } = renderHook(({ url }) => useListing(url), {
			initialProps: { url: "local/root" },
		});
		await waitFor(() => expect(result.current[1]).toBe(false));
		const firstListing = result.current[0];

		rerender({ url: "local/root" });
		await waitFor(() => expect(result.current[1]).toBe(false));
		expect(result.current[0]).toBe(firstListing);
	});
});
