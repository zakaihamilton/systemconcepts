import { act, render, waitFor } from "@testing-library/react";
import { useTranslations } from "@util/domain/translations";
import { ResearchStore } from "../../ResearchStore/ResearchStore";
import { buildSearchIndex } from "../buildSearchIndex";
import ResearchIndexer from "./ResearchIndexer.js";

jest.mock("@util/domain/translations");
jest.mock("../../ResearchStore/ResearchStore", () => ({
	ResearchStore: {
		useState: jest.fn().mockReturnValue({ indexing: false }),
		update: jest.fn((fn) => {
			const state = {};
			fn(state);
			return state;
		}),
	},
}));
jest.mock("@util/browser/store", () => ({
	useLocalStorage: jest.fn(),
}));
jest.mock("@util/storage/storage", () => ({}));
jest.mock("../buildSearchIndex", () => ({
	buildSearchIndex: jest.fn(),
}));
jest.mock("@util/api/logger", () => ({
	logger: { error: jest.fn() },
}));

describe("ResearchIndexer Component", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		jest.useFakeTimers();
		useTranslations.mockReturnValue({
			LOADING_TAGS: "Loading tags",
			DONE: "Done",
			NO_TAGS_FOUND: "No tags",
			INDEXING_FAILED: "Failed",
		});
		ResearchStore.useState.mockReturnValue({ indexing: false });
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	it("renders nothing", () => {
		const { container } = render(<ResearchIndexer />);
		expect(container.firstChild).toBeNull();
	});

	it("builds index successfully and clears status", async () => {
		ResearchStore.useState.mockReturnValue({ indexing: true });
		buildSearchIndex.mockImplementation(async ({ onStatus, onProgress }) => {
			onStatus("working");
			onProgress(50);
			return { ok: true };
		});

		render(<ResearchIndexer />);

		await waitFor(() => expect(buildSearchIndex).toHaveBeenCalled());
		expect(ResearchStore.update).toHaveBeenCalled();
		act(() => {
			jest.advanceTimersByTime(2000);
		});
	});

	it("handles NO_TAGS_FOUND", async () => {
		ResearchStore.useState.mockReturnValue({ indexing: true });
		buildSearchIndex.mockResolvedValue({
			ok: false,
			reason: "NO_TAGS_FOUND",
		});
		render(<ResearchIndexer />);
		await waitFor(() => expect(buildSearchIndex).toHaveBeenCalled());
	});

	it("handles indexing errors", async () => {
		ResearchStore.useState.mockReturnValue({ indexing: true });
		buildSearchIndex.mockRejectedValue(new Error("boom"));
		render(<ResearchIndexer />);
		await waitFor(() => expect(buildSearchIndex).toHaveBeenCalled());
	});

	it("skips callbacks when unmounted mid-index", async () => {
		ResearchStore.useState.mockReturnValue({ indexing: true });
		let resolve;
		buildSearchIndex.mockImplementation(
			() =>
				new Promise((r) => {
					resolve = r;
				}),
		);
		const { unmount } = render(<ResearchIndexer />);
		await waitFor(() => expect(buildSearchIndex).toHaveBeenCalled());
		unmount();
		await act(async () => {
			resolve({ ok: true, cancelledAfterWrite: true });
		});
	});

	it("does not start when indexing is false", () => {
		ResearchStore.useState.mockReturnValue({ indexing: false });
		render(<ResearchIndexer />);
		expect(buildSearchIndex).not.toHaveBeenCalled();
	});
});
