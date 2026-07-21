import storage from "@util/storage/storage";
import Cookies from "js-cookie";
import { writeCompressedFile } from "../bundle";
import { addSyncLog } from "../logs";
import { SyncActiveStore } from "../syncState";
import { uploadUpdates } from "./uploadUpdates";

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

describe("uploadUpdates", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		storage.createFolderPath.mockResolvedValue(undefined);
		storage.writeFile.mockResolvedValue(undefined);
		writeCompressedFile.mockResolvedValue(undefined);
		SyncActiveStore.update((state) => {
			state.stopping = false;
		});
	});

	it("uploads local files whose version is newer than remote as compressed JSON", async () => {
		storage.readFile.mockResolvedValue('{"a":1}');

		const localManifest = [{ path: "/alpha.json", version: "2" }];
		const remoteManifest = [{ path: "/alpha.json", version: "1" }];

		const result = await uploadUpdates(localManifest, remoteManifest);

		expect(writeCompressedFile).toHaveBeenCalledWith(
			"/aws/sync/alpha.json.gz",
			{ a: 1 },
			expect.any(Set),
		);
		expect(result.hasChanges).toBe(true);
		expect(result.complete).toBe(true);
		expect(result.manifest[0].version).toBe("2");
	});

	it("uploads binary files directly without JSON parsing", async () => {
		storage.readFile.mockResolvedValue("YmluYXJ5");

		const localManifest = [{ path: "/photo.png", version: "2" }];
		const remoteManifest = [{ path: "/photo.png", version: "1" }];

		await uploadUpdates(localManifest, remoteManifest);

		expect(storage.writeFile).toHaveBeenCalledWith(
			"/aws/sync/photo.png",
			"YmluYXJ5",
		);
		expect(writeCompressedFile).not.toHaveBeenCalled();
	});

	it("does nothing when there is nothing newer to upload", async () => {
		const remoteManifest = [{ path: "/alpha.json", version: "2" }];
		const result = await uploadUpdates(
			[{ path: "/alpha.json", version: "2" }],
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

	it("skips locally deleted files and files with no remote counterpart", async () => {
		const localManifest = [
			{ path: "/deleted.json", version: "5", deleted: true },
			{ path: "/new.json", version: "1" },
		];
		const result = await uploadUpdates(localManifest, []);

		expect(result.hasChanges).toBe(false);
		expect(storage.readFile).not.toHaveBeenCalled();
	});

	it("skips a file whose local content cannot be read", async () => {
		storage.readFile.mockResolvedValue(null);

		const result = await uploadUpdates(
			[{ path: "/alpha.json", version: "2" }],
			[{ path: "/alpha.json", version: "1" }],
		);

		expect(result.hasChanges).toBe(false);
		expect(result.counts.failed).toBe(1);
	});

	it("logs and skips a file when the upload throws", async () => {
		storage.readFile.mockResolvedValue('{"a":1}');
		writeCompressedFile.mockRejectedValue(new Error("network failed"));

		const result = await uploadUpdates(
			[{ path: "/alpha.json", version: "2" }],
			[{ path: "/alpha.json", version: "1" }],
		);

		expect(result.counts.failed).toBe(1);
		expect(addSyncLog).toHaveBeenCalledWith(
			"Failed to upload: /alpha.json",
			"error",
		);
	});

	it("reports progress via an injected progress tracker", async () => {
		storage.readFile.mockResolvedValue('{"a":1}');
		const progressTracker = { updateProgress: jest.fn() };

		await uploadUpdates(
			[{ path: "/alpha.json", version: "2" }],
			[{ path: "/alpha.json", version: "1" }],
			"local/sync",
			"aws/sync",
			progressTracker,
		);

		expect(progressTracker.updateProgress).toHaveBeenCalledWith(
			"uploadUpdates",
			expect.objectContaining({ total: 1 }),
		);
	});

	it("stops uploading once a stop is requested mid-batch", async () => {
		storage.readFile.mockResolvedValue('{"a":1}');
		const localManifest = Array.from({ length: 11 }, (_, i) => ({
			path: `/f-${i}.json`,
			version: "2",
		}));
		const remoteManifest = localManifest.map((f) => ({ ...f, version: "1" }));

		let calls = 0;
		writeCompressedFile.mockImplementation(async () => {
			calls++;
			if (calls === 1) {
				SyncActiveStore.update((state) => {
					state.stopping = true;
				});
			}
		});

		const result = await uploadUpdates(localManifest, remoteManifest);

		expect(addSyncLog).toHaveBeenCalledWith(
			"Upload stopped by user",
			"warning",
		);
		expect(result.complete).toBe(false);
	});

	// Per-file failures are swallowed inside uploadFile's own try/catch, so the
	// outer 403/ACCESS_DENIED handling can only be exercised via a failure in the
	// surrounding orchestration code (e.g. the injected progress tracker).
	it("warns a visitor role about restricted write access on a 403", async () => {
		Cookies.get.mockReturnValue("visitor");
		storage.readFile.mockResolvedValue('{"a":1}');
		const progressTracker = {
			updateProgress: jest.fn(() => {
				throw { status: 403 };
			}),
		};

		const remoteManifest = [{ path: "/alpha.json", version: "1" }];
		const result = await uploadUpdates(
			[{ path: "/alpha.json", version: "2" }],
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
		Cookies.get.mockReturnValue("student");
		storage.readFile.mockResolvedValue('{"a":1}');
		const progressTracker = {
			updateProgress: jest.fn(() => {
				throw new Error("ACCESS_DENIED");
			}),
		};

		await uploadUpdates(
			[{ path: "/alpha.json", version: "2" }],
			[{ path: "/alpha.json", version: "1" }],
			"local/sync",
			"aws/sync",
			progressTracker,
		);

		expect(addSyncLog).toHaveBeenCalledWith(
			"Skipping updates upload (read-only access)",
			"warning",
		);
	});

	it("rethrows an unrelated error after logging it", async () => {
		storage.readFile.mockResolvedValue('{"a":1}');
		const progressTracker = {
			updateProgress: jest.fn(() => {
				throw new Error("disk exploded");
			}),
		};

		await expect(
			uploadUpdates(
				[{ path: "/alpha.json", version: "2" }],
				[{ path: "/alpha.json", version: "1" }],
				"local/sync",
				"aws/sync",
				progressTracker,
			),
		).rejects.toThrow("disk exploded");
		expect(addSyncLog).toHaveBeenCalledWith(
			expect.stringContaining("Upload updates failed"),
			"error",
		);
	});

	it("treats a missing remote manifest as empty", async () => {
		const result = await uploadUpdates(
			[{ path: "/alpha.json", version: "2" }],
			null,
		);
		expect(result.hasChanges).toBe(false);
		expect(result.manifest).toBeNull();
	});
});
