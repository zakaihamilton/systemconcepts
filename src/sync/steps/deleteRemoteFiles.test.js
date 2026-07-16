import { moveFileToTrash } from "../trash";
import { deleteRemoteFiles } from "./deleteRemoteFiles";

jest.mock("../logs", () => ({ addSyncLog: jest.fn() }));
jest.mock("../trash", () => ({ moveFileToTrash: jest.fn() }));

describe("deleteRemoteFiles", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		moveFileToTrash.mockResolvedValue({ moved: false, missing: true });
	});

	it("moves both possible remote representations to recoverable trash", async () => {
		moveFileToTrash
			.mockResolvedValueOnce({ moved: false, missing: true })
			.mockResolvedValueOnce({ moved: true, missing: false });

		const result = await deleteRemoteFiles(
			[{ path: "/bundle.json", deleted: true }],
			"aws/sync",
			"sync-1",
		);

		expect(moveFileToTrash).toHaveBeenNthCalledWith(
			1,
			"aws/sync",
			"sync-1",
			"/bundle.json",
		);
		expect(moveFileToTrash).toHaveBeenNthCalledWith(
			2,
			"aws/sync",
			"sync-1",
			"/bundle.json.gz",
		);
		expect(result.complete).toBe(true);
	});

	it("reports an incomplete result without hard deletion when a move fails", async () => {
		moveFileToTrash.mockRejectedValue(new Error("network failed"));

		const result = await deleteRemoteFiles(
			[{ path: "/bundle.json", deleted: true }],
			"aws/sync",
			"sync-1",
		);

		expect(result.complete).toBe(false);
		expect(result.counts.failed).toBe(1);
	});
});
