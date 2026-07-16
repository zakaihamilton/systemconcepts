import storage from "@util/storage/storage";
import { addSyncLog } from "../logs";
import { removeDeletedFiles } from "./removeDeletedFiles";

jest.mock("@util/storage/storage", () => ({
	__esModule: true,
	default: {
		exists: jest.fn(),
		deleteFile: jest.fn(),
		writeFile: jest.fn(),
	},
}));

jest.mock("../logs", () => ({ addSyncLog: jest.fn() }));

describe("removeDeletedFiles", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("preserves previously synced files absent from the manifest for admins", async () => {
		const remoteManifest = [];
		remoteManifest.loadedFromManifest = true;
		const localManifest = [
			{ path: "/bundle.json", version: "4" },
			{ path: "/american/2026.json", version: "3" },
		];

		const result = await removeDeletedFiles(
			localManifest,
			remoteManifest,
			"local/sync",
			false,
		);

		expect(storage.deleteFile).not.toHaveBeenCalled();
		expect(storage.writeFile).not.toHaveBeenCalled();
		expect(result).toEqual({ manifest: localManifest, hasChanges: false });
		expect(addSyncLog).toHaveBeenCalledWith(
			"Keeping 2 local file(s) absent from the remote manifest for reconciliation",
			"warning",
		);
	});
});
