import {
	createFreshnessService,
	getManifestSignature,
	persistManifestSignature,
} from "./freshnessService";

describe("getManifestSignature", () => {
	it("returns an empty string for non-array manifests", () => {
		expect(getManifestSignature(null)).toBe("");
		expect(getManifestSignature({})).toBe("");
	});
});

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

	it("returns null for migration configs", async () => {
		const service = createFreshnessService({
			readManifest: jest.fn(),
			storageAdapter: { exists: jest.fn() },
			findMissingFiles: jest.fn(),
			log: jest.fn(),
			logger: { warn: jest.fn() },
		});

		await expect(
			service.getReadOnlyManifestFreshness(
				{
					name: "Legacy",
					localPath: "local/legacy",
					remotePath: "aws/legacy",
					direction: "bi",
					uploadsRole: "admin",
					migration: true,
				},
				"user-1",
			),
		).resolves.toBeNull();
	});

	it("returns null when the manifest is empty or not an array", async () => {
		const config = {
			name: "Main",
			localPath: "local/sync",
			remotePath: "aws/sync",
			direction: "bi",
			uploadsRole: "admin",
		};
		const emptyService = createFreshnessService({
			readManifest: jest.fn().mockResolvedValue([]),
			storageAdapter: { exists: jest.fn() },
			findMissingFiles: jest.fn(),
			log: jest.fn(),
			logger: { warn: jest.fn() },
		});
		await expect(
			emptyService.getReadOnlyManifestFreshness(config, "user-1"),
		).resolves.toBeNull();

		const brokenService = createFreshnessService({
			readManifest: jest.fn().mockResolvedValue({ broken: true }),
			storageAdapter: { exists: jest.fn() },
			findMissingFiles: jest.fn(),
			log: jest.fn(),
			logger: { warn: jest.fn() },
		});
		await expect(
			brokenService.getReadOnlyManifestFreshness(config, "user-1"),
		).resolves.toBeNull();
	});

	it("reports fresh when the signature matches and no files are missing", async () => {
		const manifest = [
			{ path: "groups.json", modified: 1, version: 1, hash: "abc" },
		];
		const signature = getManifestSignature(manifest);
		localStorage.setItem("sync_manifest_signature:aws/sync:user-1", signature);
		const service = createFreshnessService({
			readManifest: jest.fn().mockResolvedValue(manifest),
			storageAdapter: { exists: jest.fn().mockResolvedValue(true) },
			findMissingFiles: jest.fn().mockResolvedValue([]),
			log: jest.fn(),
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

		expect(result).toMatchObject({ fresh: true, missingLocalFiles: [] });
	});

	it("returns null and logs when the manifest cannot be read", async () => {
		const logger = { warn: jest.fn() };
		const service = createFreshnessService({
			readManifest: jest.fn().mockRejectedValue(new Error("network")),
			storageAdapter: { exists: jest.fn() },
			findMissingFiles: jest.fn(),
			log: jest.fn(),
			logger,
		});

		await expect(
			service.getReadOnlyManifestFreshness(
				{
					name: "Main",
					localPath: "local/sync",
					remotePath: "aws/sync",
					direction: "bi",
					uploadsRole: "admin",
				},
				"user-1",
			),
		).resolves.toBeNull();
		expect(logger.warn).toHaveBeenCalledWith(
			expect.stringContaining("Manifest freshness check failed"),
			"network",
		);
	});

	it("persists signatures through the exported helper", async () => {
		persistManifestSignature({
			storageKey: "sync_manifest_signature:aws/sync:user-1",
			signature: "sig-1",
		});
		expect(
			localStorage.getItem("sync_manifest_signature:aws/sync:user-1"),
		).toBe("sig-1");
		persistManifestSignature(null);
	});
});
