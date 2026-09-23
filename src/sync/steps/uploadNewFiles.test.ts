import storage from "@util/storage/storage";
import Cookies from "js-cookie";
import { writeCompressedFile } from "../bundle";
import { addSyncLog } from "../logs";
import { SyncActiveStore } from "../syncState";
import { uploadNewFiles } from "./uploadNewFiles";

jest.mock("@util/storage/storage", () => ({
	__esModule: true,
	default: {
		readFile: jest.fn(),
		createFolderPath: jest.fn(),
		writeFile: jest.fn(),
	},
}));

jest.mock("../bundle", () => ({ writeCompressedFile: jest.fn() }));
jest.mock("../logs", () => ({ addSyncLog: jest.fn() }));
jest.mock("js-cookie", () => ({
	__esModule: true,
	default: { get: jest.fn() },
}));

describe("uploadNewFiles", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		asMock(storage.createFolderPath).mockResolvedValue(undefined);
		asMock(storage.writeFile).mockResolvedValue(undefined);
		asMock(writeCompressedFile).mockResolvedValue(undefined);
		SyncActiveStore.update((state) => {
			state.stopping = false;
		});
	});

	it("uploads local files that are absent from the remote manifest", async () => {
		asMock(storage.readFile).mockResolvedValue('{"a":1}');

		const localManifest = [{ path: "/new.json", version: "1" }];
		const result = await uploadNewFiles(localManifest, []);

		expect(writeCompressedFile).toHaveBeenCalledWith(
			"/aws/sync/new.json.gz",
			{ a: 1 },
			expect.any(Set),
		);
		expect(result.hasChanges).toBe(true);
		expect(result.complete).toBe(true);
		expect(result.manifest).toEqual([{ path: "/new.json", version: "1" }]);
	});

	it("uploads new binary files directly, without JSON parsing", async () => {
		asMock(storage.readFile).mockResolvedValue("YmluYXJ5");

		await uploadNewFiles([{ path: "/photo.png", version: "1" }], []);

		expect(storage.writeFile).toHaveBeenCalledWith(
			"/aws/sync/photo.png",
			"YmluYXJ5",
		);
		expect(writeCompressedFile).not.toHaveBeenCalled();
	});

	it("does nothing when every local file already exists remotely", async () => {
		const remoteManifest = [{ path: "/existing.json", version: "1" }];
		const result = await uploadNewFiles(
			[{ path: "/existing.json", version: "1" }],
			remoteManifest,
		);

		expect(result).toEqual({
			manifest: remoteManifest,
			hasChanges: false,
			complete: true,
			counts: { attempted: 0, succeeded: 0, failed: 0 },
		});
		expect(storage.readFile).not.toHaveBeenCalled();
	});

	it("skips locally deleted files even if absent from remote", async () => {
		const result = await uploadNewFiles(
			[{ path: "/deleted.json", version: "1", deleted: true }],
			[],
		);

		expect(result.hasChanges).toBe(false);
		expect(storage.readFile).not.toHaveBeenCalled();
	});

	it("skips a file whose local content cannot be read", async () => {
		asMock(storage.readFile).mockResolvedValue(null);

		const result = await uploadNewFiles(
			[{ path: "/new.json", version: "1" }],
			[],
		);

		expect(result.hasChanges).toBe(false);
		expect(result.counts.failed).toBe(1);
	});

	it("logs and skips a file when the upload throws", async () => {
		asMock(storage.readFile).mockResolvedValue('{"a":1}');
		asMock(writeCompressedFile).mockRejectedValue(new Error("network failed"));

		const result = await uploadNewFiles(
			[{ path: "/new.json", version: "1" }],
			[],
		);

		expect(result.counts.failed).toBe(1);
		expect(addSyncLog).toHaveBeenCalledWith(
			"Failed to upload new: /new.json",
			"error",
		);
	});

	it("reports progress via an injected progress tracker", async () => {
		asMock(storage.readFile).mockResolvedValue('{"a":1}');
		const progressTracker = { updateProgress: jest.fn() };

		await uploadNewFiles(
			[{ path: "/new.json", version: "1" }],
			[],
			"local/sync",
			"aws/sync",
			progressTracker,
		);

		expect(progressTracker.updateProgress).toHaveBeenCalledWith(
			"uploadNewFiles",
			expect.objectContaining({ total: 1 }),
		);
	});

	it("stops uploading once a stop is requested mid-batch", async () => {
		asMock(storage.readFile).mockResolvedValue('{"a":1}');
		const localManifest = Array.from({ length: 11 }, (_, i) => ({
			path: `/f-${i}.json`,
			version: "1",
		}));

		let calls = 0;
		asMock(writeCompressedFile).mockImplementation(async () => {
			calls++;
			if (calls === 1) {
				SyncActiveStore.update((state) => {
					state.stopping = true;
				});
			}
		});

		const result = await uploadNewFiles(localManifest, []);

		expect(addSyncLog).toHaveBeenCalledWith(
			"Upload stopped by user",
			"warning",
		);
		expect(result.complete).toBe(false);
	});

	it("warns a visitor role about restricted write access on a 403", async () => {
		asMock(Cookies.get).mockReturnValue("visitor");
		asMock(storage.readFile).mockResolvedValue('{"a":1}');
		const progressTracker = {
			updateProgress: jest.fn(() => {
				throw { status: 403 };
			}),
		};

		const remoteManifest: any = [];
		const result: any = await uploadNewFiles(
			[{ path: "/new.json", version: "1" }],
			remoteManifest,
			"local/sync",
			"aws/sync",
			progressTracker,
		);

		expect(result).toEqual({
			manifest: remoteManifest,
			hasChanges: false,
			complete: false,
			counts: { attempted: 0, succeeded: 0, failed: 1 },
		});
		expect(addSyncLog).toHaveBeenCalledWith(
			expect.stringContaining("Visitor access restricted"),
			"warning",
		);
	});

	it("skips uploads quietly for a non-visitor role on ACCESS_DENIED", async () => {
		asMock(Cookies.get).mockReturnValue("student");
		asMock(storage.readFile).mockResolvedValue('{"a":1}');
		const progressTracker = {
			updateProgress: jest.fn(() => {
				throw new Error("ACCESS_DENIED");
			}),
		};

		await uploadNewFiles(
			[{ path: "/new.json", version: "1" }],
			[],
			"local/sync",
			"aws/sync",
			progressTracker,
		);

		expect(addSyncLog).toHaveBeenCalledWith(
			"Skipping new files upload (read-only access)",
			"warning",
		);
	});

	it("rethrows an unrelated error after logging it", async () => {
		asMock(storage.readFile).mockResolvedValue('{"a":1}');
		const progressTracker = {
			updateProgress: jest.fn(() => {
				throw new Error("disk exploded");
			}),
		};

		await expect(
			uploadNewFiles(
				[{ path: "/new.json", version: "1" }],
				[],
				"local/sync",
				"aws/sync",
				progressTracker,
			),
		).rejects.toThrow("disk exploded");
		expect(addSyncLog).toHaveBeenCalledWith(
			expect.stringContaining("Upload new files failed"),
			"error",
		);
	});

	it("treats a missing remote manifest as empty", async () => {
		const result = await uploadNewFiles([], null);
		expect(result.hasChanges).toBe(false);
		expect(result.manifest).toBeNull();
	});
});
