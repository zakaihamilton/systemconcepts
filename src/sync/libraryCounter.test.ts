import storage from "@util/storage/storage";
import Cookies from "js-cookie";
import {
	bumpLibraryCounter,
	getSavedLibraryCounter,
	readLibraryCounter,
	saveLibraryCounter,
} from "./libraryCounter";
import { SyncActiveStore } from "./syncState";

jest.mock("@util/storage/storage", () => ({
	__esModule: true,
	default: {
		readFile: jest.fn(),
		createFolderPath: jest.fn(),
		writeFile: jest.fn(),
	},
}));

jest.mock("js-cookie", () => ({
	__esModule: true,
	default: { get: jest.fn() },
}));

describe("readLibraryCounter", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("returns 0 when the counter file does not exist", async () => {
		storage.readFile.mockResolvedValue(null);
		await expect(readLibraryCounter()).resolves.toBe(0);
	});

	it("returns the persisted counter value", async () => {
		storage.readFile.mockResolvedValue(
			JSON.stringify({ counter: 7, updatedAt: 123 }),
		);
		await expect(readLibraryCounter()).resolves.toBe(7);
	});

	it("returns 0 for a non-numeric counter value", async () => {
		storage.readFile.mockResolvedValue(JSON.stringify({ counter: "abc" }));
		await expect(readLibraryCounter()).resolves.toBe(0);
	});

	it("returns 0 and does not throw on malformed JSON", async () => {
		storage.readFile.mockResolvedValue("{not json");
		await expect(readLibraryCounter()).resolves.toBe(0);
	});
});

describe("getSavedLibraryCounter / saveLibraryCounter", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		localStorage.clear();
	});

	it("returns null when there is no signed-in user", () => {
		Cookies.get.mockReturnValue(undefined);
		expect(getSavedLibraryCounter()).toBeNull();
	});

	it("round-trips a saved counter for the current user", () => {
		Cookies.get.mockReturnValue("user-1");
		saveLibraryCounter(4);
		expect(getSavedLibraryCounter()).toBe(4);
		expect(localStorage.getItem("sync_libraryCounter:user-1")).toBe("4");
	});

	it("does not persist a non-finite counter", () => {
		Cookies.get.mockReturnValue("user-1");
		saveLibraryCounter(NaN);
		expect(localStorage.getItem("sync_libraryCounter:user-1")).toBeNull();
	});

	it("returns null for a non-numeric stored value", () => {
		Cookies.get.mockReturnValue("user-1");
		localStorage.setItem("sync_libraryCounter:user-1", "not-a-number");
		expect(getSavedLibraryCounter()).toBeNull();
	});
});

describe("bumpLibraryCounter", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		localStorage.clear();
		storage.createFolderPath.mockResolvedValue(undefined);
		storage.writeFile.mockResolvedValue(undefined);
		SyncActiveStore.update((state) => {
			state.libraryUpdateCounter = 0;
		});
	});

	it("increments the counter, persists it, and updates the sync store", async () => {
		storage.readFile.mockResolvedValue(JSON.stringify({ counter: 2 }));

		const newCounter = await bumpLibraryCounter();

		expect(newCounter).toBe(3);
		expect(storage.writeFile).toHaveBeenCalledWith(
			"/local/library/library-counter.json",
			expect.stringContaining('"counter": 3'),
		);
		expect(SyncActiveStore.getRawState().libraryUpdateCounter).toBe(1);
	});

	it("starts from 0 when no counter file exists yet", async () => {
		storage.readFile.mockResolvedValue(null);

		const newCounter = await bumpLibraryCounter();

		expect(newCounter).toBe(1);
	});

	it("returns null in non-browser environments", () => {
		const originalWindow = global.window;
		// @ts-expect-error test shim
		delete global.window;
		expect(getSavedLibraryCounter()).toBeNull();
		global.window = originalWindow;
	});

	it("does not save when there is no signed-in user", () => {
		localStorage.clear();
		Cookies.get.mockReturnValue(undefined);
		saveLibraryCounter(3);
		expect(localStorage.getItem("sync_libraryCounter:user-1")).toBeNull();
	});

	it("returns 0 when reading the counter file fails", async () => {
		storage.readFile.mockRejectedValue(new Error("read failed"));
		await expect(readLibraryCounter()).resolves.toBe(0);
	});

	it("increments an existing libraryUpdateCounter in the sync store", async () => {
		storage.readFile.mockResolvedValue(JSON.stringify({ counter: 4 }));
		SyncActiveStore.update((state) => {
			state.libraryUpdateCounter = 2;
		});

		await bumpLibraryCounter();

		expect(SyncActiveStore.getRawState().libraryUpdateCounter).toBe(3);
	});
});
