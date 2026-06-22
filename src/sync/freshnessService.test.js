import {
	createFreshnessService,
	getManifestSignature,
} from "./freshnessService";

describe("sync manifest freshness", () => {
	beforeEach(() => {
		localStorage.clear();
	});

	it("repairs missing local files even when the manifest signature is unchanged", async () => {
		const manifest = [
			{ path: "groups.json", modified: 1, version: 1, hash: "abc" },
		];
		const signature = getManifestSignature(manifest);
		localStorage.setItem("sync_manifest_signature:aws/sync:user-1", signature);
		const log = jest.fn();
		const service = createFreshnessService({
			readManifest: jest.fn().mockResolvedValue(manifest),
			storageAdapter: { exists: jest.fn().mockResolvedValue(false) },
			findMissingFiles: jest.fn().mockResolvedValue(["local/sync/groups.json"]),
			log,
			logger: { warn: jest.fn() },
		});

		const result = await service.getReadOnlyManifestFreshness(
			{
				name: "Main",
				localPath: "local/sync",
				remotePath: "aws/sync",
				direction: "bi",
				uploadsRole: "admin",
			},
			"user-1",
		);

		expect(result).toMatchObject({
			fresh: false,
			missingLocalFiles: ["local/sync/groups.json"],
		});
		expect(log).toHaveBeenCalledWith(
			expect.stringContaining("1 local file(s) are missing"),
			"warning",
		);
	});

	it("keeps freshness signatures isolated by user", async () => {
		const manifest = [{ path: "bookmark.json", hash: "one" }];
		const signature = getManifestSignature(manifest);
		localStorage.setItem(
			"sync_manifest_signature:aws/personal/user-1:user-1",
			signature,
		);
		const service = createFreshnessService({
			readManifest: jest.fn().mockResolvedValue(manifest),
			storageAdapter: { exists: jest.fn().mockResolvedValue(true) },
			findMissingFiles: jest.fn().mockResolvedValue([]),
			log: jest.fn(),
			logger: { warn: jest.fn() },
		});
		const config = {
			name: "Personal",
			localPath: "local/personal",
			remotePath: "aws/personal/{userid}",
			direction: "bi",
			uploadsRole: "student",
		};

		const userOne = await service.getReadOnlyManifestFreshness(
			config,
			"user-1",
		);
		const userTwo = await service.getReadOnlyManifestFreshness(
			config,
			"user-2",
		);

		expect(userOne.fresh).toBe(true);
		expect(userTwo.fresh).toBe(false);
		expect(userOne.storageKey).not.toBe(userTwo.storageKey);
	});
});
