import { getFileInfo } from "@sync/hash";
import { addSyncLog } from "@sync/logs";
import storage from "@util/storage/storage";
import { compactLegacySessionThumbnails } from "./sessionCompaction";

jest.mock("@sync/hash", () => ({ getFileInfo: jest.fn() }));
jest.mock("@sync/logs", () => ({ addSyncLog: jest.fn() }));
jest.mock("@util/storage/storage", () => ({
	readFile: jest.fn(),
	writeFile: jest.fn(),
	createFolderPath: jest.fn(),
}));

const manifest = [
	{ path: "/group/2026.json", hash: "before", size: 10, version: "7" },
	{ path: "/bundle.json", hash: "unchanged", size: 20, version: "3" },
];

describe("compactLegacySessionThumbnails", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		storage.readFile.mockImplementation(async (path) => {
			if (path === "/local/sync/files.json") return JSON.stringify(manifest);
			if (path === "/local/sync/group/2026.json") {
				return JSON.stringify({
					sessions: [
						{ id: "legacy", thumbnail: "data:image/webp;base64,large" },
						{ id: "path", thumbnail: "/aws/image.jpg" },
					],
				});
			}
			if (path === "/local/sync/bundle.json") {
				return JSON.stringify({ sessions: [{ id: "no-image" }] });
			}
			return null;
		});
		getFileInfo.mockResolvedValue({ hash: "after", size: 8 });
	});

	it("removes only legacy data URLs and preserves the manifest version", async () => {
		await expect(compactLegacySessionThumbnails()).resolves.toEqual({
			compacted: 1,
			skipped: false,
		});

		const [, compactedContent] = storage.writeFile.mock.calls.find(
			([path]) => path === "/local/sync/group/2026.json",
		);
		expect(JSON.parse(compactedContent).sessions).toEqual([
			{ id: "legacy" },
			{ id: "path", thumbnail: "/aws/image.jpg" },
		]);

		const [, manifestContent] = storage.writeFile.mock.calls.find(
			([path]) => path === "/local/sync/files.json",
		);
		expect(JSON.parse(manifestContent)).toEqual([
			{ path: "/group/2026.json", hash: "after", size: 8, version: "7" },
			manifest[1],
		]);
		expect(addSyncLog).toHaveBeenCalledWith(
			expect.stringContaining("1 local session file"),
			"info",
		);
	});

	it("uses its marker to skip a completed compaction", async () => {
		storage.readFile.mockImplementation(async (path) => {
			if (path === "/local/sync/files.json") return JSON.stringify(manifest);
			if (path === "/local/session-thumbnail-compaction.json") {
				return JSON.stringify({
					version: 1,
					manifestSignature:
						"/bundle.json:unchanged:3|/group/2026.json:before:7",
				});
			}
			return null;
		});

		await expect(compactLegacySessionThumbnails()).resolves.toEqual({
			compacted: 0,
			skipped: true,
		});
		expect(storage.writeFile).not.toHaveBeenCalled();
	});
});
