import { SyncActiveStore } from "@sync/syncState";
import { act, render, waitFor } from "@testing-library/react";
import { useFile } from "@util/storage/storage";
import { useRecentHistory } from "./history";

jest.mock("@util/storage/storage", () => ({
	useFile: jest.fn(),
}));

let latestResult;
let writeSpy;
let currentHistory;
let loadingValue;
let errorValue;

function Harness() {
	latestResult = useRecentHistory();
	return null;
}

function setup({ history = [], loading = false, error = null } = {}) {
	currentHistory = history;
	loadingValue = loading;
	errorValue = error;
	writeSpy = jest.fn((updater) => {
		currentHistory =
			typeof updater === "function" ? updater(currentHistory) : updater;
		return Promise.resolve();
	});
	useFile.mockImplementation(() => [
		currentHistory,
		loadingValue,
		errorValue,
		writeSpy,
	]);
	render(<Harness />);
}

describe("useRecentHistory", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		latestResult = null;
		SyncActiveStore.update((state) => {
			state.personalUpdateCounter = 0;
		});
	});

	it("calls useFile with the history path, sync revision depends, and JSON mapping", () => {
		setup();
		const [, depends, mapping] = useFile.mock.calls[0];
		expect(useFile.mock.calls[0][0]).toBe("local/personal/history.json");
		expect(depends).toEqual([0]);
		expect(mapping(null)).toEqual([]);
		expect(mapping(JSON.stringify([{ id: 1 }]))).toEqual([{ id: 1 }]);
	});

	it("reloads history when personalUpdateCounter increments after sync", () => {
		setup();
		expect(useFile.mock.calls[0][1]).toEqual([0]);

		act(() => {
			SyncActiveStore.update((state) => {
				state.personalUpdateCounter = 2;
			});
		});

		expect(useFile.mock.calls.at(-1)[1]).toEqual([2]);
	});

	it("adds a new session to the front of the history with a timestamp", async () => {
		setup({ history: [] });
		const [, addToHistory] = latestResult;

		await act(async () => {
			addToHistory({ group: "american", name: "Test", date: "2024-05-05" });
		});

		expect(currentHistory).toHaveLength(1);
		expect(currentHistory[0]).toMatchObject({
			group: "american",
			name: "Test",
			date: "2024-05-05",
		});
		expect(typeof currentHistory[0].timestamp).toBe("number");
	});

	it("does not duplicate when the same session is already the most recent entry", async () => {
		setup({
			history: [
				{
					group: "american",
					name: "Test",
					date: "2024-05-05",
					timestamp: 1,
				},
			],
		});
		const [, addToHistory] = latestResult;

		await act(async () => {
			addToHistory({ group: "american", name: "Test", date: "2024-05-05" });
		});

		expect(currentHistory).toHaveLength(1);
		expect(currentHistory[0].timestamp).toBe(1);
	});

	it("adds a new entry when the session differs from the most recent one", async () => {
		setup({
			history: [
				{ group: "american", name: "Old", date: "2024-01-01", timestamp: 1 },
			],
		});
		const [, addToHistory] = latestResult;

		await act(async () => {
			addToHistory({ group: "american", name: "New", date: "2024-05-05" });
		});

		expect(currentHistory).toHaveLength(2);
		expect(currentHistory[0].name).toBe("New");
		expect(currentHistory[1].name).toBe("Old");
	});

	it("caps the history at 300 entries", async () => {
		const existing = Array.from({ length: 300 }, (_, i) => ({
			group: "g",
			name: `session-${i}`,
			date: "2024-01-01",
			timestamp: i,
		}));
		setup({ history: existing });
		const [, addToHistory] = latestResult;

		await act(async () => {
			addToHistory({ group: "g", name: "newest", date: "2024-06-01" });
		});

		expect(currentHistory).toHaveLength(300);
		expect(currentHistory[0].name).toBe("newest");
	});

	it("does nothing when the session is missing required fields", async () => {
		setup({ history: [] });
		const [, addToHistory] = latestResult;

		await act(async () => {
			addToHistory(null);
			addToHistory({ group: "american" });
			addToHistory({ group: "american", name: "Test" });
		});

		expect(writeSpy).not.toHaveBeenCalled();
	});

	it("removes a matching item from history", async () => {
		setup({
			history: [
				{ group: "american", name: "A", date: "2024-01-01" },
				{ group: "american", name: "B", date: "2024-02-02" },
			],
		});
		const [, , , , removeFromHistory] = latestResult;

		await act(async () => {
			removeFromHistory({ group: "american", name: "A", date: "2024-01-01" });
		});

		expect(currentHistory).toEqual([
			{ group: "american", name: "B", date: "2024-02-02" },
		]);
	});

	it("removeFromHistory handles an empty/undefined history", async () => {
		setup({ history: undefined });
		const [, , , , removeFromHistory] = latestResult;

		await act(async () => {
			removeFromHistory({ group: "american", name: "A", date: "2024-01-01" });
		});

		expect(currentHistory).toEqual([]);
	});

	it("exposes loading and error state from useFile", async () => {
		setup({ history: [], loading: true, error: new Error("boom") });

		await waitFor(() => {
			const [, , loadingHistory, errorHistory] = latestResult;
			expect(loadingHistory).toBe(true);
			expect(errorHistory).toBeInstanceOf(Error);
		});
	});
});
