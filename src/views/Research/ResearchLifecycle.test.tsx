import "./researchTestSetup";
import { ContentSize } from "@components/Page/Content";
import {
	act,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { useDeviceType } from "@util/browser/styles";
import { useSessions } from "@util/domain/sessions";
import { useTranslations } from "@util/domain/translations";
import Cookies from "js-cookie";
import Research from "./";
import {
	setResearchTestLibraryUpdateCounter,
	setupResearchViewTest,
} from "./researchTestSetup";

let mockResearchState: any;

jest.mock("@components/Virtualized/VariableSizeList", () => {
	const React = require("react");
	return React.forwardRef(function MockList(_props: any, ref: any) {
		React.useImperativeHandle(ref, () => ({
			scrollToItem: jest.fn(),
			resetAfterIndex: jest.fn(),
		}));
		return <div data-testid="virtual-list" />;
	});
});
jest.mock("./PageIndicator", () => () => null);
jest.mock("./ResultsOutline", () => () => null);
jest.mock("./SearchResultItem", () => () => (
	<div data-testid="search-result-item" />
));
jest.mock("@views/Library/Article/JumpDialog", () => () => null);

describe("Research View Lifecycle and Search Progress", () => {
	const mockSize = { width: 800, height: 600, emPixels: 16 };

	beforeEach(() => {
		setupResearchViewTest({
			setResearchState: (state) => {
				mockResearchState = state;
			},
			setLibraryState: () => {},
			useTranslations,
			useSessions,
			useDeviceType,
			cookies: Cookies,
		});
	});

	const renderResearch = () =>
		render(
			<ContentSize.Provider value={mockSize}>
				<Research />
			</ContentSize.Provider>,
		);

	describe("index lifecycle and sync", () => {
		it("auto-builds the index when no index files exist", async () => {
			const storage = require("@util/storage/storage");
			asMock(storage.exists).mockResolvedValue(false);
			mockResearchState.hasSearched = false;
			renderResearch();
			await waitFor(() => {
				expect(mockResearchState.indexing).toBe(true);
			});
		});

		it("deletes a corrupted index and rebuilds", async () => {
			const { decodeBinaryIndex } = require("@util/data/searchIndexBinary");
			const storage = require("@util/storage/storage");
			asMock(storage.exists).mockResolvedValue(true);
			asMock(storage.readFile).mockResolvedValue("bad-index");
			asMock(decodeBinaryIndex).mockImplementation(() => {
				throw new Error("corrupt");
			});
			mockResearchState.hasSearched = false;
			renderResearch();
			await waitFor(() => {
				expect(storage.deleteFile).toHaveBeenCalled();
				expect(mockResearchState.indexing).toBe(true);
			});
		});

		it("logs when deleting a corrupted index also fails", async () => {
			const storage = require("@util/storage/storage");
			const { logger } = require("@util/api/logger");
			asMock(storage.exists).mockResolvedValue(true);
			asMock(storage.readFile).mockRejectedValue(new Error("corrupt"));
			asMock(storage.deleteFile).mockRejectedValue(new Error("delete failed"));
			renderResearch();
			await act(async () => {
				await Promise.resolve();
				await Promise.resolve();
			});
			expect(logger.error).toHaveBeenCalledWith(
				"Failed to delete corrupted index:",
				expect.any(Error),
			);
		});

		it("reloads index and tags when the library update counter changes", async () => {
			const { decodeBinaryIndex } = require("@util/data/searchIndexBinary");
			const storage = require("@util/storage/storage");
			asMock(storage.exists).mockResolvedValue(true);
			asMock(storage.readFile).mockResolvedValue("binary-index");
			asMock(decodeBinaryIndex).mockReturnValue({ v: 5, f: [], t: {} });
			const view = renderResearch();
			await waitFor(() => {
				expect(storage.readFile).toHaveBeenCalled();
			});
			const initialReads = asMock(storage.readFile).mock.calls.length;
			setResearchTestLibraryUpdateCounter(1);
			view.rerender(
				<ContentSize.Provider value={mockSize}>
					<Research />
				</ContentSize.Provider>,
			);
			await waitFor(() => {
				expect(asMock(storage.readFile).mock.calls.length).toBeGreaterThan(
					initialReads,
				);
			});
		});

		it("skips initial search while store state is still loading", async () => {
			const { runResearchSearch } = require("./runResearchSearch");
			const { decodeBinaryIndex } = require("@util/data/searchIndexBinary");
			const storage = require("@util/storage/storage");
			mockResearchState._loaded = false;
			mockResearchState.query = "grace";
			mockResearchState.hasSearched = false;
			asMock(storage.exists).mockResolvedValue(true);
			asMock(storage.readFile).mockResolvedValue("binary-index");
			asMock(decodeBinaryIndex).mockReturnValue({
				v: 5,
				f: ["a"],
				t: { grace: [-1, 0] },
			});
			renderResearch();
			await waitFor(() => {
				expect(storage.readFile).toHaveBeenCalled();
			});
			expect(runResearchSearch).not.toHaveBeenCalled();
		});
	});

	describe("session-derived and tag filters", () => {
		it("loads session group, year, and type filters", async () => {
			const storage = require("@util/storage/storage");
			asMock(useSessions).mockReturnValue([
				[
					{
						name: "Grace study",
						group: "ai",
						year: "2024",
						type: "video",
					},
				],
			]);
			asMock(storage.exists).mockImplementation((path: any) =>
				Promise.resolve(path.endsWith("tags.json")),
			);
			asMock(storage.readFile).mockResolvedValue(JSON.stringify([]));
			renderResearch();
			fireEvent.click(screen.getByRole("button", { name: "Filters" }));
			await waitFor(() => {
				expect(screen.getByRole("button", { name: "AI" })).toBeInTheDocument();
			});
			expect(screen.getByRole("button", { name: "2024" })).toBeInTheDocument();
			expect(screen.getByRole("button", { name: "Video" })).toBeInTheDocument();
		});

		it("loads filters when sessions is null", async () => {
			const storage = require("@util/storage/storage");
			asMock(useSessions).mockReturnValue([null]);
			asMock(storage.exists).mockImplementation((path: any) =>
				Promise.resolve(path.endsWith("tags.json")),
			);
			asMock(storage.readFile).mockResolvedValue(
				JSON.stringify([{ author: "Paul" }]),
			);
			renderResearch();
			fireEvent.click(screen.getByRole("button", { name: "Filters" }));
			await waitFor(() => {
				expect(
					screen.getByRole("button", { name: "Paul" }),
				).toBeInTheDocument();
			});
		});

		it("skips session filters when group year and type are empty", async () => {
			const storage = require("@util/storage/storage");
			asMock(useSessions).mockReturnValue([
				[{ name: "Bare session", group: "", year: "", type: "" }],
			]);
			asMock(storage.exists).mockImplementation((path: any) =>
				Promise.resolve(path.endsWith("tags.json")),
			);
			asMock(storage.readFile).mockResolvedValue(JSON.stringify([]));
			renderResearch();
			fireEvent.click(screen.getByRole("button", { name: "Filters" }));
			await waitFor(() => {
				expect(screen.getByRole("complementary")).toBeInTheDocument();
			});
			expect(screen.queryByRole("button", { name: "Bare session" })).toBeNull();
		});

		it("logs when loading tags fails", async () => {
			const storage = require("@util/storage/storage");
			const { logger } = require("@util/api/logger");
			asMock(storage.exists).mockResolvedValue(true);
			asMock(storage.readFile).mockRejectedValue(new Error("tags read failed"));
			renderResearch();
			await waitFor(() => {
				expect(logger.error).toHaveBeenCalledWith(
					"Failed to load tags for filters:",
					expect.any(Error),
				);
			});
		});

		it("does not update filters after unmount", async () => {
			jest.useFakeTimers();
			const storage = require("@util/storage/storage");
			asMock(storage.exists).mockImplementation((path: any) =>
				Promise.resolve(path.endsWith("tags.json")),
			);
			asMock(storage.readFile).mockImplementation(
				() =>
					new Promise((resolve) => {
						setTimeout(() => resolve(JSON.stringify([{ author: "Late" }])), 50);
					}),
			);
			const view = renderResearch();
			view.unmount();
			await act(async () => {
				jest.advanceTimersByTime(100);
				await Promise.resolve();
			});
			jest.useRealTimers();
		});
	});

	describe("search progress and errors", () => {
		beforeEach(() => {
			jest.useFakeTimers();
		});

		afterEach(() => {
			jest.useRealTimers();
		});

		const loadIndex = () => {
			const { decodeBinaryIndex } = require("@util/data/searchIndexBinary");
			const storage = require("@util/storage/storage");
			asMock(storage.exists).mockResolvedValue(true);
			asMock(storage.readFile).mockResolvedValue("binary-index");
			asMock(decodeBinaryIndex).mockReturnValue({
				v: 5,
				f: ["article-1"],
				t: { grace: [-1, 0] },
			});
		};

		it("shows delayed search progress while a query runs", async () => {
			const { runResearchSearch } = require("./runResearchSearch");
			loadIndex();
			mockResearchState.query = "grace";
			mockResearchState.hasSearched = false;
			asMock(runResearchSearch).mockImplementation(
				() =>
					new Promise((resolve) => {
						setTimeout(
							() =>
								resolve({
									results: [{ docId: "1", matches: [{ index: 0 }] }],
									highlight: ["grace"],
									cancelled: false,
								}),
							2000,
						);
					}),
			);
			asMock(useTranslations).mockReturnValue({
				RESEARCH: "Research",
				SESSIONS: "Sessions",
				ARTICLES: "Articles",
				SUMMARIES: "Summaries",
				SEARCHING: "Searching...",
				SEARCH: "Search",
				SEARCH_ARTICLES: "Search...",
				ALL: "All",
				FILTERS: "Filters",
				HIDE_SEARCH: "Hide Search",
				RESEARCH_HELP: "Search your library",
				SEARCH_HINT: "Use quotes",
			});
			renderResearch();
			await act(async () => {
				await Promise.resolve();
			});
			fireEvent.click(screen.getByRole("button", { name: "Search" }));
			act(() => {
				jest.advanceTimersByTime(1000);
			});
			expect(screen.getByText("Searching...")).toBeInTheDocument();
			await act(async () => {
				jest.advanceTimersByTime(2000);
				await Promise.resolve();
			});
		});

		it("ignores cancelled search results", async () => {
			const { runResearchSearch } = require("./runResearchSearch");
			loadIndex();
			mockResearchState.query = "grace";
			mockResearchState.results = [{ docId: "keep", matches: [{ index: 0 }] }];
			mockResearchState.hasSearched = true;
			asMock(runResearchSearch).mockResolvedValue({
				results: [{ docId: "new", matches: [{ index: 0 }] }],
				highlight: [],
				cancelled: true,
			});
			const view = renderResearch();
			await act(async () => {
				await Promise.resolve();
			});
			fireEvent.click(screen.getByRole("button", { name: "Search" }));
			await act(async () => {
				jest.runOnlyPendingTimers();
				await Promise.resolve();
			});
			view.rerender(
				<ContentSize.Provider value={mockSize}>
					<Research />
				</ContentSize.Provider>,
			);
			expect(mockResearchState.results[0].docId).toBe("keep");
		});

		it("recovers when search throws", async () => {
			const { runResearchSearch } = require("./runResearchSearch");
			loadIndex();
			mockResearchState.query = "grace";
			mockResearchState.hasSearched = false;
			asMock(runResearchSearch).mockRejectedValue(new Error("search failed"));
			renderResearch();
			await act(async () => {
				await Promise.resolve();
			});
			fireEvent.click(screen.getByRole("button", { name: "Search" }));
			await act(async () => {
				jest.runOnlyPendingTimers();
				await Promise.resolve();
			});
			expect(screen.getByRole("button", { name: "Search" })).not.toBeDisabled();
		});

		it("re-runs search when sessions are added after an initial search", async () => {
			const { runResearchSearch } = require("./runResearchSearch");
			loadIndex();
			mockResearchState.query = "grace";
			mockResearchState.hasSearched = true;
			mockResearchState.results = [{ docId: "1", matches: [{ index: 0 }] }];
			const view = renderResearch();
			await act(async () => {
				await Promise.resolve();
			});
			const initialCalls = asMock(runResearchSearch).mock.calls.length;
			asMock(useSessions).mockReturnValue([
				[
					{
						name: "Grace study",
						group: "ai",
						year: "2026",
						date: "2026-01-01",
					},
					{ name: "Hope study", group: "ai", year: "2026", date: "2026-01-02" },
				],
			]);
			view.rerender(
				<ContentSize.Provider value={mockSize}>
					<Research />
				</ContentSize.Provider>,
			);
			await act(async () => {
				jest.runOnlyPendingTimers();
				await Promise.resolve();
			});
			expect(asMock(runResearchSearch).mock.calls.length).toBeGreaterThan(
				initialCalls,
			);
		});

		it("reports search progress from runResearchSearch callbacks", async () => {
			const { decodeBinaryIndex } = require("@util/data/searchIndexBinary");
			const storage = require("@util/storage/storage");
			const { runResearchSearch } = require("./runResearchSearch");
			mockResearchState.query = "grace";
			mockResearchState.hasSearched = false;
			asMock(storage.exists).mockResolvedValue(true);
			asMock(storage.readFile).mockResolvedValue("binary-index");
			asMock(decodeBinaryIndex).mockReturnValue({ v: 5, f: ["a"], t: {} });
			asMock(runResearchSearch).mockImplementation(
				async ({ onProgress }: any) => {
					onProgress(42);
					return {
						results: [{ docId: "1", matches: [{ index: 0 }] }],
						highlight: ["grace"],
						cancelled: false,
					};
				},
			);
			asMock(useTranslations).mockReturnValue({
				RESEARCH: "Research",
				SESSIONS: "Sessions",
				ARTICLES: "Articles",
				SUMMARIES: "Summaries",
				SEARCHING: "Searching...",
				SEARCH: "Search",
				SEARCH_ARTICLES: "Search...",
				ALL: "All",
				FILTERS: "Filters",
				HIDE_SEARCH: "Hide Search",
				RESEARCH_HELP: "Search your library",
				SEARCH_HINT: "Use quotes",
				RESULT: "result",
				RESULTS: "results",
				MATCH: "matches",
				ARTICLE: "Article",
			});
			renderResearch();
			await act(async () => {
				await Promise.resolve();
			});
			fireEvent.click(screen.getByRole("button", { name: "Search" }));
			await act(async () => {
				jest.advanceTimersByTime(1000);
				await Promise.resolve();
			});
			expect(screen.getByText("Searching...")).toBeInTheDocument();
		});

		it("hides search progress after completion", async () => {
			const { decodeBinaryIndex } = require("@util/data/searchIndexBinary");
			const storage = require("@util/storage/storage");
			const { runResearchSearch } = require("./runResearchSearch");
			mockResearchState.query = "grace";
			mockResearchState.hasSearched = false;
			asMock(storage.exists).mockResolvedValue(true);
			asMock(storage.readFile).mockResolvedValue("binary-index");
			asMock(decodeBinaryIndex).mockReturnValue({ v: 5, f: ["a"], t: {} });
			asMock(runResearchSearch).mockResolvedValue({
				results: [],
				highlight: [],
				cancelled: false,
			});
			asMock(useTranslations).mockReturnValue({
				RESEARCH: "Research",
				SESSIONS: "Sessions",
				ARTICLES: "Articles",
				SUMMARIES: "Summaries",
				SEARCHING: "Searching...",
				SEARCH: "Search",
				SEARCH_ARTICLES: "Search...",
				ALL: "All",
				FILTERS: "Filters",
				HIDE_SEARCH: "Hide Search",
				RESEARCH_HELP: "Search your library",
				SEARCH_HINT: "Use quotes",
			});
			const view = renderResearch();
			await act(async () => {
				await Promise.resolve();
			});
			fireEvent.click(screen.getByRole("button", { name: "Search" }));
			await act(async () => {
				jest.advanceTimersByTime(1000);
				await Promise.resolve();
			});
			expect(screen.getByText("Searching...")).toBeInTheDocument();
			await act(async () => {
				jest.advanceTimersByTime(600);
				await Promise.resolve();
			});
			view.rerender(
				<ContentSize.Provider value={mockSize}>
					<Research />
				</ContentSize.Provider>,
			);
			expect(screen.queryByText("Searching...")).not.toBeInTheDocument();
		});
	});
});
