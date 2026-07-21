import storage from "@util/storage/storage";
import { moveFileToTrash } from "../trash";
import { applyRemoteTombstones } from "./applyRemoteTombstones";

jest.mock("@util/storage/storage", () => ({
	__esModule: true,
	default: { writeFile: jest.fn() },
}));

jest.mock("../logs", () => ({ addSyncLog: jest.fn() }));
jest.mock("../trash", () => ({ moveFileToTrash: jest.fn() }));

describe("applyRemoteTombstones", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		storage.writeFile.mockResolvedValue(undefined);
	});

	it("returns early with no changes when there are no tombstone candidates", async () => {
		const localManifest = [{ path: "/alpha.json", version: "1" }];
		const result = await applyRemoteTombstones(
			localManifest,
			[{ path: "/alpha.json", version: "1", deleted: false }],
			"local/sync",
			true,
			"sync-1",
		);

		expect(result).toEqual({
			manifest: localManifest,
			complete: true,
			hasChanges: false,
			counts: { attempted: 0, succeeded: 0, failed: 0 },
		});
		expect(moveFileToTrash).not.toHaveBeenCalled();
	});

	it("treats a remote deletion for an unknown local file as a candidate", async () => {
		moveFileToTrash.mockResolvedValue({ moved: false, missing: true });

		const result = await applyRemoteTombstones(
			[],
			[{ path: "/gone.json", version: "1", deleted: true }],
			"local/sync",
			true,
			"sync-1",
		);

		expect(moveFileToTrash).toHaveBeenCalledWith(
			"local/sync",
			"sync-1",
			"/gone.json",
		);
		expect(result.manifest[0]).toEqual({
			path: "/gone.json",
			version: "1",
			deleted: true,
		});
	});

	it("does not re-process a file already marked deleted locally at an equal or higher version", async () => {
		const localManifest = [{ path: "/gone.json", version: "3", deleted: true }];
		const result = await applyRemoteTombstones(
			localManifest,
			[{ path: "/gone.json", version: "2", deleted: true }],
			"local/sync",
			true,
			"sync-1",
		);

		expect(moveFileToTrash).not.toHaveBeenCalled();
		expect(result.hasChanges).toBe(false);
	});

	it("forces deletion when uploads are disabled, regardless of version", async () => {
		moveFileToTrash.mockResolvedValue({ moved: true, missing: false });
		const localManifest = [{ path: "/keep.json", version: "9" }];

		const result = await applyRemoteTombstones(
			localManifest,
			[{ path: "/keep.json", version: "1", deleted: true }],
			"local/sync",
			false,
			"sync-1",
		);

		expect(moveFileToTrash).toHaveBeenCalled();
		expect(result.manifest[0].deleted).toBe(true);
	});

	it("does not delete a local file whose version is ahead of the remote tombstone when uploads are enabled", async () => {
		const localManifest = [{ path: "/keep.json", version: "9" }];

		const result = await applyRemoteTombstones(
			localManifest,
			[{ path: "/keep.json", version: "1", deleted: true }],
			"local/sync",
			true,
			"sync-1",
		);

		expect(moveFileToTrash).not.toHaveBeenCalled();
		expect(result.hasChanges).toBe(false);
	});

	it("moves the file to trash, updates the manifest, and persists it to disk", async () => {
		moveFileToTrash.mockResolvedValue({ moved: true, missing: false });
		const localManifest = [{ path: "/old.json", version: "1" }];

		const result = await applyRemoteTombstones(
			localManifest,
			[{ path: "/old.json", version: "2", deleted: true }],
			"local/sync",
			true,
			"sync-1",
		);

		expect(storage.writeFile).toHaveBeenCalledWith(
			"/local/sync/files.json",
			JSON.stringify(result.manifest, null, 4),
		);
		expect(result.complete).toBe(true);
		expect(result.hasChanges).toBe(true);
		expect(result.counts).toEqual({ attempted: 1, succeeded: 1, failed: 0 });
	});

	it("still marks the manifest entry deleted when the remote file is already missing from local trash", async () => {
		moveFileToTrash.mockResolvedValue({ moved: false, missing: true });

		const result = await applyRemoteTombstones(
			[{ path: "/missing.json", version: "1" }],
			[{ path: "/missing.json", version: "2", deleted: true }],
			"local/sync",
			true,
			"sync-1",
		);

		expect(result.manifest[0].deleted).toBe(true);
		expect(result.counts.succeeded).toBe(1);
	});

	it("counts a failure and reports incomplete when moving to trash throws", async () => {
		moveFileToTrash.mockRejectedValue(new Error("fs error"));

		const result = await applyRemoteTombstones(
			[{ path: "/broken.json", version: "1" }],
			[{ path: "/broken.json", version: "2", deleted: true }],
			"local/sync",
			true,
			"sync-1",
		);

		expect(result.complete).toBe(false);
		expect(result.counts).toEqual({ attempted: 1, succeeded: 0, failed: 1 });
		expect(storage.writeFile).not.toHaveBeenCalled();
	});

	it("still applies a remote tombstone when the local copy is deleted at a lower version", async () => {
		moveFileToTrash.mockResolvedValue({ moved: true, missing: false });
		const localManifest = [{ path: "/gone.json", version: "1", deleted: true }];

		const result = await applyRemoteTombstones(
			localManifest,
			[{ path: "/gone.json", version: "3", deleted: true }],
			"local/sync",
			true,
			"sync-1",
		);

		expect(moveFileToTrash).toHaveBeenCalled();
		expect(result.manifest[0]).toMatchObject({ deleted: true, version: "3" });
	});
});
