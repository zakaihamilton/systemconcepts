import { UpdateSessionsStore } from "@sync/syncState";
import { act, render } from "@testing-library/react";
import { useUpdateSessions } from "./index";
import { updateGroupProcess } from "./updateGroup";
import { getListing, updateBundleFile } from "./utils";

jest.mock("@util/api/logger", () => ({
	logger: {
		debug: jest.fn(),
		error: jest.fn(),
		info: jest.fn(),
		warn: jest.fn(),
	},
}));

jest.mock("./updateGroup", () => ({
	updateGroupProcess: jest.fn(),
}));

jest.mock("./utils", () => ({
	getListing: jest.fn(),
	updateBundleFile: jest.fn(),
}));

const GROUPS = [
	{ name: "active", disabled: false, merged: false, bundled: false },
	{ name: "disabled", disabled: true, merged: false, bundled: false },
	{ name: "bundled", disabled: false, merged: false, bundled: true },
];

let latestApi;

function Harness({ groups }) {
	latestApi = useUpdateSessions(groups);
	return null;
}

function renderHarness(groups) {
	render(<Harness groups={groups} />);
}

describe("useUpdateSessions", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		latestApi = null;
		UpdateSessionsStore.update((s) => {
			s.busy = false;
			s.status = [];
			s.start = 0;
		});
		getListing.mockResolvedValue([
			{ name: "active" },
			{ name: "disabled" },
			{ name: "bundled" },
			{ name: "unknown" },
		]);
		updateGroupProcess.mockResolvedValue([]);
		updateBundleFile.mockResolvedValue();
	});

	it("updates only enabled groups by default", async () => {
		renderHarness(GROUPS);

		await act(async () => {
			await latestApi.updateSessions(false);
		});

		expect(updateGroupProcess).toHaveBeenCalledTimes(2);
		expect(updateGroupProcess).toHaveBeenCalledWith(
			"active",
			false,
			false,
			false,
			false,
		);
		expect(updateGroupProcess).toHaveBeenCalledWith(
			"bundled",
			false,
			false,
			false,
			true,
		);
		expect(updateGroupProcess).not.toHaveBeenCalledWith(
			"disabled",
			expect.anything(),
			expect.anything(),
			expect.anything(),
			expect.anything(),
		);
	});

	it("includes disabled groups when includeDisabled is true", async () => {
		renderHarness(GROUPS);

		await act(async () => {
			await latestApi.updateSessions(true);
		});

		expect(updateGroupProcess).toHaveBeenCalledTimes(3);
	});

	it("calls updateBundleFile with flattened bundled results", async () => {
		updateGroupProcess.mockImplementation(async (name) => {
			if (name === "bundled") {
				return [{ id: "session1", group: "bundled" }];
			}
			return undefined;
		});
		renderHarness(GROUPS);

		await act(async () => {
			await latestApi.updateSessions(false);
		});

		expect(updateBundleFile).toHaveBeenCalledWith([
			{ id: "session1", group: "bundled" },
		]);
	});

	it("does not call updateBundleFile when no bundled sessions are returned", async () => {
		updateGroupProcess.mockResolvedValue(undefined);
		renderHarness(GROUPS);

		await act(async () => {
			await latestApi.updateSessions(false);
		});

		expect(updateBundleFile).not.toHaveBeenCalled();
	});

	it("skips groups that are not present in the provided groups list", async () => {
		renderHarness(GROUPS);

		await act(async () => {
			await latestApi.updateSessions(true);
		});

		expect(updateGroupProcess).not.toHaveBeenCalledWith(
			"unknown",
			expect.anything(),
			expect.anything(),
			expect.anything(),
			expect.anything(),
		);
	});

	it("logs and continues with an empty listing when getListing throws", async () => {
		const { logger } = require("@util/api/logger");
		getListing.mockRejectedValue(new Error("listing failed"));
		renderHarness(GROUPS);

		let result;
		await act(async () => {
			result = await latestApi.updateSessions(false);
		});

		expect(logger.error).toHaveBeenCalledWith(expect.any(Error));
		expect(result).toEqual([]);
		expect(updateGroupProcess).not.toHaveBeenCalled();
	});

	it("returns early when getListing resolves to a falsy value", async () => {
		getListing.mockResolvedValue(null);
		renderHarness(GROUPS);

		let result;
		await act(async () => {
			result = await latestApi.updateSessions(false);
		});

		expect(result).toBeUndefined();
		expect(updateGroupProcess).not.toHaveBeenCalled();
	});

	it("sets busy while running and resets it afterward", async () => {
		let resolveProcess;
		const processPromise = new Promise((resolve) => {
			resolveProcess = resolve;
		});
		updateGroupProcess.mockImplementation(() => processPromise);
		renderHarness(GROUPS);

		let pending;
		act(() => {
			pending = latestApi.updateSessions(false);
		});

		expect(UpdateSessionsStore.getRawState().busy).toBe(true);
		expect(latestApi.updateSessions).toBe(false);

		await act(async () => {
			resolveProcess([]);
			await pending;
		});

		expect(UpdateSessionsStore.getRawState().busy).toBe(false);
		expect(latestApi.updateSessions).toBeInstanceOf(Function);
	});

	it("updateAllSessions forces a full update on all included groups", async () => {
		renderHarness(GROUPS);

		await act(async () => {
			await latestApi.updateAllSessions(false);
		});

		expect(updateGroupProcess).toHaveBeenCalledWith(
			"active",
			true,
			true,
			false,
			false,
		);
	});

	it("updateAllMetadataCurrentYear forces metadata refresh without a full resync", async () => {
		renderHarness(GROUPS);

		await act(async () => {
			await latestApi.updateAllMetadataCurrentYear(false);
		});

		expect(updateGroupProcess).toHaveBeenCalledWith(
			"active",
			false,
			true,
			false,
			false,
		);
	});

	it("updateRecentSessions limits the update to the last 30 days", async () => {
		renderHarness(GROUPS);

		await act(async () => {
			await latestApi.updateRecentSessions(false);
		});

		expect(updateGroupProcess).toHaveBeenCalledWith(
			"active",
			false,
			true,
			false,
			false,
			null,
			30,
		);
	});

	it("updateRecentSessions skips groups missing from the groups list or disabled", async () => {
		renderHarness(GROUPS);

		await act(async () => {
			await latestApi.updateRecentSessions(false);
		});

		expect(updateGroupProcess).not.toHaveBeenCalledWith(
			"disabled",
			expect.anything(),
			expect.anything(),
			expect.anything(),
			expect.anything(),
			expect.anything(),
			expect.anything(),
		);
	});

	it("updateGroup (updateSpecificGroup) targets a single group by name", async () => {
		updateGroupProcess.mockResolvedValue([{ id: "s1", group: "active" }]);
		renderHarness(GROUPS);

		let result;
		await act(async () => {
			result = await latestApi.updateGroup("active", true, false, "s1");
		});

		expect(updateGroupProcess).toHaveBeenCalledWith(
			"active",
			true,
			false,
			false,
			false,
			"s1",
		);
		expect(result).toEqual([{ id: "s1", group: "active" }]);
		expect(updateBundleFile).not.toHaveBeenCalled();
	});

	it("updateGroup calls updateBundleFile when targeting a bundled group with results", async () => {
		updateGroupProcess.mockResolvedValue([{ id: "s1", group: "bundled" }]);
		renderHarness(GROUPS);

		await act(async () => {
			await latestApi.updateGroup("bundled", true, false);
		});

		expect(updateBundleFile).toHaveBeenCalledWith([
			{ id: "s1", group: "bundled" },
		]);
	});

	it("updateGroup handles an unknown group name gracefully", async () => {
		updateGroupProcess.mockResolvedValue(undefined);
		renderHarness(GROUPS);

		let result;
		await act(async () => {
			result = await latestApi.updateGroup("missing", false, false);
		});

		expect(updateGroupProcess).toHaveBeenCalledWith(
			"missing",
			false,
			false,
			undefined,
			undefined,
			null,
		);
		expect(result).toBeUndefined();
	});

	it("updateAllSessions logs listing failures and returns early on falsy listings", async () => {
		const { logger } = require("@util/api/logger");
		getListing.mockRejectedValueOnce(new Error("all listing failed"));
		renderHarness(GROUPS);

		let result;
		await act(async () => {
			result = await latestApi.updateAllSessions(false);
		});
		expect(logger.error).toHaveBeenCalled();
		expect(result).toEqual([]);

		getListing.mockResolvedValue(null);
		await act(async () => {
			result = await latestApi.updateAllSessions(false);
		});
		expect(result).toBeUndefined();
	});

	it("updateAllMetadataCurrentYear bundles results and honors includeDisabled", async () => {
		updateGroupProcess.mockImplementation(async (name) =>
			name === "bundled" ? [{ id: "s1" }] : [],
		);
		renderHarness(GROUPS);

		await act(async () => {
			await latestApi.updateAllMetadataCurrentYear(true);
		});
		expect(updateGroupProcess).toHaveBeenCalledWith(
			"disabled",
			false,
			true,
			false,
			false,
		);
		expect(updateBundleFile).toHaveBeenCalledWith([{ id: "s1" }]);
	});

	it("updateAllSessions bundles results and returns early on falsy listings", async () => {
		updateGroupProcess.mockImplementation(async (name) =>
			name === "bundled" ? [{ id: "all" }] : [],
		);
		renderHarness(GROUPS);

		await act(async () => {
			await latestApi.updateAllSessions(false);
		});
		expect(updateBundleFile).toHaveBeenCalledWith([{ id: "all" }]);

		getListing.mockResolvedValue(null);
		await act(async () => {
			await latestApi.updateAllMetadataCurrentYear(false);
		});
		expect(updateGroupProcess).toHaveBeenCalled();
	});

	it("updateRecentSessions logs listing failures and bundles recent results", async () => {
		const { logger } = require("@util/api/logger");
		getListing.mockRejectedValueOnce(new Error("recent listing failed"));
		renderHarness(GROUPS);
		await act(async () => {
			await latestApi.updateRecentSessions(false);
		});
		expect(logger.error).toHaveBeenCalled();

		getListing.mockResolvedValue([{ name: "bundled" }]);
		updateGroupProcess.mockResolvedValue([{ id: "recent" }]);
		await act(async () => {
			await latestApi.updateRecentSessions(false);
		});
		expect(updateBundleFile).toHaveBeenCalledWith([{ id: "recent" }]);
	});
});
