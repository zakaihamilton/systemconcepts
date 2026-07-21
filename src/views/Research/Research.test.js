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
import { setHash, setPath, usePathItems } from "@util/domain/views";
import Cookies from "js-cookie";
import Research from "./";

let mockResearchState;
let mockLibraryState;
let mockLibraryUpdateCounter = 0;
const mockListScrollToItem = jest.fn();
const mockListResetAfterIndex = jest.fn();
let latestListProps;

jest.mock("@util/domain/translations");
jest.mock("@views/ResearchStore/ResearchStore", () => ({
	ResearchStore: {
		useState: jest.fn(() => mockResearchState),
		update: jest.fn((updater) => updater(mockResearchState)),
	},
}));
jest.mock("@util/domain/sessions");
jest.mock("@util/data/searchIndexBinary", () => ({
	decodeBinaryIndex: jest.fn(),
}));
jest.mock("@util/domain/loadParagraphs", () => ({
	loadParagraphsForFile: jest.fn(),
}));
jest.mock("@views/Library/Store", () => ({
	LibraryStore: {
		getRawState: jest.fn(() => mockLibraryState),
		update: jest.fn((updater) => updater(mockLibraryState)),
	},
}));
jest.mock("@sync/syncState", () => ({
	SyncActiveStore: {
		useState: jest.fn((selector) =>
			selector
				? selector({ libraryUpdateCounter: mockLibraryUpdateCounter })
				: mockLibraryUpdateCounter,
		),
	},
}));
jest.mock("@util/browser/styles");
jest.mock("@util/storage/storage", () => ({
	exists: jest.fn().mockResolvedValue(false),
	readFile: jest.fn().mockResolvedValue(""),
	deleteFile: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("@util/domain/views", () => ({
	setHash: jest.fn(),
	setPath: jest.fn(),
	usePathItems: jest.fn().mockReturnValue([]),
}));
jest.mock("./runResearchSearch", () => ({
	runResearchSearch: jest.fn(),
}));
jest.mock("@components/Virtualized/VariableSizeList", () => {
	const React = require("react");
	return React.forwardRef(function MockList(props, ref) {
		latestListProps = props;
		React.useImperativeHandle(ref, () => ({
			scrollToItem: mockListScrollToItem,
			resetAfterIndex: mockListResetAfterIndex,
		}));
		return <div data-testid="virtual-list" />;
	});
});
jest.mock(
	"./PageIndicator",
	() =>
		({ current, total, visible, label, onClick }) =>
			visible ? (
				<button type="button" onClick={onClick} aria-haspopup="menu">
					{label} {current} / {total}
				</button>
			) : null,
);
jest.mock(
	"./ResultsOutline",
	() =>
		({ open, results, onSelect, currentIndex }) =>
			open ? (
				<div role="menu" aria-label="Results list">
					{results.map((doc, index) => (
						<button
							key={doc.docId || index}
							type="button"
							role="menuitem"
							aria-current={index === currentIndex ? "true" : undefined}
							onClick={() => onSelect(index)}
						>
							{doc.tag?.title || doc.name}
						</button>
					))}
				</div>
			) : null,
);
jest.mock("./SearchResultItem", () => () => (
	<div data-testid="search-result-item" />
));
jest.mock("@components/Toolbar", () => ({
	registerToolbar: jest.fn(),
	useToolbar: jest.fn(),
}));
jest.mock("@views/Library/Article", () => () => <div data-testid="article" />);
jest.mock(
	"@views/Library/Article/JumpDialog",
	() => (props) =>
		props.open ? (
			<div data-testid="jump-dialog">
				<button type="button" onClick={() => props.onSubmit("page", 2)}>
					jump-page
				</button>
				<button type="button" onClick={() => props.onSubmit("paragraph", 2)}>
					jump-match
				</button>
			</div>
		) : null,
);
jest.mock("js-cookie");
jest.mock("@util/api/logger", () => ({
	logger: { error: jest.fn(), debug: jest.fn(), warn: jest.fn() },
}));

describe("Research View", () => {
	const mockSize = { width: 800, height: 600, emPixels: 16 };

	beforeEach(() => {
		jest.clearAllMocks();
		mockLibraryUpdateCounter = 0;
		latestListProps = null;
		const { runResearchSearch } = require("./runResearchSearch");
		runResearchSearch.mockImplementation(
			jest.requireActual("./runResearchSearch").runResearchSearch,
		);
		global.ResizeObserver = jest.fn().mockImplementation(() => ({
			observe: jest.fn(),
			disconnect: jest.fn(),
			unobserve: jest.fn(),
		}));
		mockResearchState = {
			query: "",
			filterTags: [],
			source: "all",
			results: [{ docId: "1", text: "result" }],
			hasSearched: true,
			_loaded: true,
			highlight: [],
			indexing: false,
			progress: 0,
			status: "",
			indexTimestamp: 0,
		};
		mockLibraryState = { tags: [] };
		useTranslations.mockReturnValue({
			RESEARCH: "Research",
			SESSIONS: "Sessions",
			ARTICLES: "Articles",
			SUMMARIES: "Summaries",
			INDEXING: "Indexing...",
			SEARCH: "Search",
			SEARCH_ARTICLES: "Search...",
			ALL: "All",
			FILTERS: "Filters",
			SEARCH_FILTERS: "Search filters...",
			CLOSE: "Close",
			DONE: "Done",
			CLEAR_ALL: "Clear all",
			CLEAR: "Clear search",
			RESEARCH_HELP: "Search your library",
			SEARCH_HINT: "Use quotes for a phrase",
			SHOW_SEARCH: "Show Search",
			HIDE_SEARCH: "Hide Search",
			RESEARCH_START: "Find ideas",
			RESEARCH_START_HELP: "Search by a word",
			RESEARCH_PREPARING: "Preparing Research",
			RESEARCH_INDEX_HELP: "Index is preparing",
			SUGGESTION_TITLE: "Title",
			SUGGESTION_FILTER: "Filter",
			SUGGESTION_TERM: "Term",
			ARTICLE: "Article",
			RESULTS_LIST: "Results list",
			MATCH: "matches",
		});
		useSessions.mockReturnValue([
			[{ name: "Grace in practice", group: "ai", year: "2024" }],
			false,
			[],
		]);
		useDeviceType.mockReturnValue("desktop");
		Cookies.get.mockReturnValue("admin");
	});

	const renderResearch = () =>
		render(
			<ContentSize.Provider value={mockSize}>
				<Research />
			</ContentSize.Provider>,
		);

	it("renders search field and virtual list", () => {
		const { getByTestId } = renderResearch();
		expect(getByTestId("virtual-list")).toBeInTheDocument();
		expect(screen.getByRole("tab", { name: "All" })).toHaveAttribute(
			"aria-selected",
			"true",
		);
	});

	it("collapses the research search panel to free vertical space", () => {
		renderResearch();
		expect(screen.getByPlaceholderText("Search...")).toBeInTheDocument();

		fireEvent.click(screen.getByRole("button", { name: "Hide Search" }));

		expect(screen.queryByPlaceholderText("Search...")).not.toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "Show Search" }),
		).toBeInTheDocument();

		fireEvent.click(screen.getByRole("button", { name: "Show Search" }));
		expect(screen.getByPlaceholderText("Search...")).toBeInTheDocument();
	});

	it("persists source tab selection", () => {
		renderResearch();
		fireEvent.click(screen.getByRole("tab", { name: "Articles" }));
		expect(mockResearchState.source).toBe("articles");
	});

	it("opens a results outline from the article number indicator", async () => {
		mockResearchState.results = [
			{ docId: "1", tag: { title: "Grace" }, matches: [{ index: 0 }] },
			{ docId: "2", tag: { title: "Hope" }, matches: [{ index: 1 }] },
		];
		renderResearch();

		const indicator = await screen.findByRole("button", {
			name: /Article 1 \/ 1/,
		});
		fireEvent.click(indicator);

		expect(
			screen.getByRole("menu", { name: "Results list" }),
		).toBeInTheDocument();
		expect(screen.getByRole("menuitem", { name: "Grace" })).toBeInTheDocument();
		expect(screen.getByRole("menuitem", { name: "Hope" })).toBeInTheDocument();
	});

	it("opens the structured filter drawer", () => {
		renderResearch();
		expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: "Filters" }));
		expect(screen.getByRole("complementary")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Done" })).toBeInTheDocument();
		expect(
			screen.getByPlaceholderText("Search filters..."),
		).toBeInTheDocument();
	});

	it("filters the filter list in the drawer", async () => {
		const storage = require("@util/storage/storage");
		storage.exists.mockImplementation((path) =>
			Promise.resolve(path.endsWith("tags.json")),
		);
		storage.readFile.mockResolvedValue(
			JSON.stringify([
				{ author: "Augustine", book: "Confessions" },
				{ author: "Aquinas", book: "Summa" },
			]),
		);

		renderResearch();
		fireEvent.click(screen.getByRole("button", { name: "Filters" }));

		await waitFor(() => {
			expect(
				screen.getByRole("button", { name: "Augustine" }),
			).toBeInTheDocument();
		});
		expect(screen.getByRole("button", { name: "Aquinas" })).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "Confessions" }),
		).toBeInTheDocument();

		fireEvent.change(screen.getByPlaceholderText("Search filters..."), {
			target: { value: "august" },
		});

		expect(
			screen.getByRole("button", { name: "Augustine" }),
		).toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: "Aquinas" }),
		).not.toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: "Confessions" }),
		).not.toBeInTheDocument();
	});

	it("sorts numbered filter labels numerically", async () => {
		const storage = require("@util/storage/storage");
		storage.exists.mockImplementation((path) =>
			Promise.resolve(path.endsWith("tags.json")),
		);
		storage.readFile.mockResolvedValue(
			JSON.stringify([
				{ article: "10. Later" },
				{ article: "2. Middle" },
				{ article: "1. First" },
			]),
		);

		renderResearch();
		fireEvent.click(screen.getByRole("button", { name: "Filters" }));

		await waitFor(() => {
			expect(
				screen.getByRole("button", { name: "1. First" }),
			).toBeInTheDocument();
		});

		const labels = screen
			.getAllByRole("button")
			.map((button) => button.textContent)
			.filter((label) => /^\d+\./.test(label));
		expect(labels).toEqual(["1. First", "2. Middle", "10. Later"]);
	});

	it("shows the initial research guidance", () => {
		mockResearchState.hasSearched = false;
		renderResearch();
		expect(screen.getByText("Preparing Research")).toBeInTheDocument();
	});

	it("shows title suggestions after entering a query", () => {
		mockResearchState.hasSearched = false;
		const view = renderResearch();
		const searchInput = screen.getByPlaceholderText("Search...");
		fireEvent.focus(searchInput);
		fireEvent.change(searchInput, { target: { value: "grace" } });
		view.rerender(
			<ContentSize.Provider value={mockSize}>
				<Research />
			</ContentSize.Provider>,
		);
		expect(screen.getByRole("listbox")).toHaveTextContent("Grace in practice");
		expect(searchInput).toHaveAttribute("role", "combobox");
		expect(searchInput).toHaveAttribute(
			"aria-controls",
			"research-suggestions",
		);
		fireEvent.keyDown(searchInput, { key: "ArrowDown" });
		expect(
			screen.getByRole("option", { name: /Grace in practice/ }),
		).toHaveAttribute("aria-selected", "true");
		fireEvent.keyDown(searchInput, { key: "Enter" });
		expect(mockResearchState.query).toBe('"Grace in practice"');
		expect(mockResearchState.hasSearched).toBe(true);
	});

	it("closes suggestions when searching with Enter", () => {
		mockResearchState.hasSearched = false;
		const view = renderResearch();
		const searchInput = screen.getByPlaceholderText("Search...");
		fireEvent.focus(searchInput);
		fireEvent.change(searchInput, { target: { value: "grace" } });
		view.rerender(
			<ContentSize.Provider value={mockSize}>
				<Research />
			</ContentSize.Provider>,
		);
		expect(screen.getByRole("listbox")).toBeInTheDocument();

		fireEvent.keyDown(searchInput, { key: "Enter" });
		view.rerender(
			<ContentSize.Provider value={mockSize}>
				<Research />
			</ContentSize.Provider>,
		);
		expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
	});

	it("closes suggestions when clicking outside the search field", () => {
		mockResearchState.hasSearched = false;
		const view = renderResearch();
		const searchInput = screen.getByPlaceholderText("Search...");
		fireEvent.focus(searchInput);
		fireEvent.change(searchInput, { target: { value: "grace" } });
		view.rerender(
			<ContentSize.Provider value={mockSize}>
				<Research />
			</ContentSize.Provider>,
		);
		expect(screen.getByRole("listbox")).toBeInTheDocument();

		fireEvent.mouseDown(screen.getByRole("button", { name: "Filters" }));
		view.rerender(
			<ContentSize.Provider value={mockSize}>
				<Research />
			</ContentSize.Provider>,
		);
		expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
	});

	it("keeps suggestions open when interacting with a suggestion", () => {
		mockResearchState.hasSearched = false;
		const view = renderResearch();
		const searchInput = screen.getByPlaceholderText("Search...");
		fireEvent.focus(searchInput);
		fireEvent.change(searchInput, { target: { value: "grace" } });
		view.rerender(
			<ContentSize.Provider value={mockSize}>
				<Research />
			</ContentSize.Provider>,
		);
		const suggestion = screen.getByRole("option", {
			name: /Grace in practice/,
		});
		fireEvent.mouseDown(suggestion);
		expect(screen.getByRole("listbox")).toBeInTheDocument();
		fireEvent.click(suggestion);
		expect(mockResearchState.query).toBe('"Grace in practice"');
	});

	it("loads v5 paragraphs for a filter-only search", async () => {
		const { decodeBinaryIndex } = require("@util/data/searchIndexBinary");
		const { loadParagraphsForFile } = require("@util/domain/loadParagraphs");
		const storage = require("@util/storage/storage");
		mockResearchState = {
			...mockResearchState,
			filterTags: [{ type: "topic", label: "Grace" }],
			hasSearched: false,
		};
		mockLibraryState.tags = [
			{ _id: "article-1", title: "Grace", topic: "Grace" },
		];
		storage.exists.mockResolvedValue(true);
		storage.readFile.mockImplementation((path) =>
			path.endsWith("tags.json")
				? JSON.stringify(mockLibraryState.tags)
				: "binary-index",
		);
		decodeBinaryIndex.mockReturnValue({ v: 5, f: ["article-1"], t: {} });
		loadParagraphsForFile.mockResolvedValue(["Grace"]);

		renderResearch();

		await waitFor(() => {
			expect(loadParagraphsForFile).toHaveBeenCalledWith(
				"article-1",
				expect.any(Map),
			);
		});
		await waitFor(() => {
			expect(mockResearchState.results).toHaveLength(1);
			expect(mockResearchState.results[0].matches).toEqual([
				{ index: 0, text: "Grace" },
			]);
		});
	});

	it("returns session matches from the v5 index", async () => {
		const { decodeBinaryIndex } = require("@util/data/searchIndexBinary");
		const { loadParagraphsForFile } = require("@util/domain/loadParagraphs");
		const storage = require("@util/storage/storage");
		const sessionId = "session|american|2026|2026-01-01|Grace study";
		mockResearchState = {
			...mockResearchState,
			query: "grace",
			hasSearched: false,
			results: [],
		};
		useSessions.mockReturnValue([
			[
				{
					name: "Grace study",
					group: "american",
					year: "2026",
					date: "2026-01-01",
					type: "video",
				},
			],
		]);
		storage.exists.mockResolvedValue(true);
		storage.readFile.mockResolvedValue("binary-index");
		decodeBinaryIndex.mockReturnValue({
			v: 5,
			f: [sessionId],
			// compressed v5 refs: -(fileIndex+1), paraIndex
			t: { grace: [-1, 1] },
		});
		loadParagraphsForFile.mockResolvedValue([
			"Grace study",
			"Grace abounds in practice",
		]);

		renderResearch();
		fireEvent.click(screen.getByRole("button", { name: "Search" }));

		await waitFor(() => {
			expect(loadParagraphsForFile).toHaveBeenCalledWith(
				sessionId,
				expect.any(Map),
			);
		});
		await waitFor(() => {
			expect(mockResearchState.results).toHaveLength(1);
			expect(mockResearchState.results[0].isSession).toBe(true);
			expect(mockResearchState.results[0].matches).toEqual([
				{ index: 1, text: "Grace abounds in practice" },
			]);
		});
	});

	it("shows start guidance when index is ready and no search yet", async () => {
		const { decodeBinaryIndex } = require("@util/data/searchIndexBinary");
		const storage = require("@util/storage/storage");
		mockResearchState.hasSearched = false;
		mockResearchState.results = [];
		storage.exists.mockResolvedValue(true);
		storage.readFile.mockResolvedValue("binary-index");
		decodeBinaryIndex.mockReturnValue({ v: 5, f: [], t: {} });

		renderResearch();
		await waitFor(() => {
			expect(screen.getByText("Find ideas")).toBeInTheDocument();
		});
	});

	it("shows indexing overlay with progress", () => {
		mockResearchState.indexing = true;
		mockResearchState.progress = 42;
		mockResearchState.status = "Building";
		renderResearch();
		expect(screen.getByText("Building")).toBeInTheDocument();
		expect(screen.getByText("42%")).toBeInTheDocument();
	});

	it("shows no-results state and clears filters", () => {
		mockResearchState.results = [];
		mockResearchState.filterTags = [{ type: "topic", label: "Grace" }];
		mockResearchState.hasSearched = true;
		useTranslations.mockReturnValue({
			RESEARCH: "Research",
			SESSIONS: "Sessions",
			ARTICLES: "Articles",
			SUMMARIES: "Summaries",
			INDEXING: "Indexing...",
			SEARCH: "Search",
			SEARCH_ARTICLES: "Search...",
			ALL: "All",
			FILTERS: "Filters",
			SEARCH_FILTERS: "Search filters...",
			CLOSE: "Close",
			DONE: "Done",
			CLEAR_ALL: "Clear all",
			CLEAR: "Clear search",
			RESEARCH_HELP: "Search your library",
			SEARCH_HINT: "Use quotes for a phrase",
			SHOW_SEARCH: "Show Search",
			HIDE_SEARCH: "Hide Search",
			RESEARCH_START: "Find ideas",
			RESEARCH_START_HELP: "Search by a word",
			RESEARCH_PREPARING: "Preparing Research",
			RESEARCH_INDEX_HELP: "Index is preparing",
			SUGGESTION_TITLE: "Title",
			SUGGESTION_FILTER: "Filter",
			SUGGESTION_TERM: "Term",
			ARTICLE: "Article",
			RESULTS_LIST: "Results list",
			MATCH: "matches",
			NO_RESULTS: "No results",
			CLEAR_FILTERS: "Clear filters",
			TOPIC: "Topic",
		});
		renderResearch();
		expect(screen.getByText("No results")).toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
		expect(mockResearchState.filterTags).toEqual([]);
	});

	it("clears the query via the clear adornment", () => {
		mockResearchState.query = "grace";
		mockResearchState.filterTags = [{ type: "topic", label: "Grace" }];
		renderResearch();
		fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
		expect(mockResearchState.query).toBe("");
		expect(mockResearchState.filterTags).toEqual([]);
		expect(mockResearchState.hasSearched).toBe(false);
		expect(mockResearchState.source).toBe("all");
	});

	it("adds a filter from the drawer and clears all", async () => {
		const storage = require("@util/storage/storage");
		storage.exists.mockImplementation((path) =>
			Promise.resolve(path.endsWith("tags.json")),
		);
		storage.readFile.mockResolvedValue(
			JSON.stringify([{ author: "Augustine", book: "Confessions" }]),
		);

		renderResearch();
		fireEvent.click(screen.getByRole("button", { name: "Filters" }));
		await waitFor(() => {
			expect(
				screen.getByRole("button", { name: "Augustine" }),
			).toBeInTheDocument();
		});

		fireEvent.click(screen.getByRole("button", { name: "Augustine" }));
		expect(mockResearchState.filterTags).toEqual([
			{ label: "Augustine", type: "author" },
		]);
		fireEvent.click(screen.getAllByRole("button", { name: "Clear all" })[0]);
		expect(mockResearchState.filterTags).toEqual([]);
	});

	it("closes the filter drawer with Done and Close", async () => {
		renderResearch();
		fireEvent.click(screen.getByRole("button", { name: "Filters" }));
		expect(screen.getByRole("complementary")).toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: "Done" }));
		expect(screen.queryByRole("complementary")).not.toBeInTheDocument();

		fireEvent.click(screen.getByRole("button", { name: "Filters" }));
		fireEvent.click(screen.getByRole("button", { name: "Close" }));
		expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
	});

	it("navigates suggestions with ArrowUp and Escape", () => {
		mockResearchState.hasSearched = false;
		const view = renderResearch();
		const searchInput = screen.getByPlaceholderText("Search...");
		fireEvent.focus(searchInput);
		fireEvent.change(searchInput, { target: { value: "grace" } });
		view.rerender(
			<ContentSize.Provider value={mockSize}>
				<Research />
			</ContentSize.Provider>,
		);
		fireEvent.keyDown(searchInput, { key: "ArrowUp" });
		expect(
			screen.getByRole("option", { name: /Grace in practice/ }),
		).toHaveAttribute("aria-selected", "true");
		fireEvent.keyDown(searchInput, { key: "Escape" });
		view.rerender(
			<ContentSize.Provider value={mockSize}>
				<Research />
			</ContentSize.Provider>,
		);
		expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
	});

	it("filters results by Sessions source tab", () => {
		mockResearchState.results = [
			{
				docId: "1",
				tag: { title: "Article" },
				matches: [{ index: 0 }],
				isSession: false,
			},
			{
				docId: "2",
				tag: { title: "Session" },
				matches: [{ index: 0 }],
				isSession: true,
			},
		];
		mockResearchState.source = "sessions";
		renderResearch();
		expect(screen.getByTestId("virtual-list")).toBeInTheDocument();
		expect(screen.getByText(/1 result/i)).toBeInTheDocument();
	});

	it("filters results by Articles source tab", () => {
		mockResearchState.results = [
			{
				docId: "1",
				tag: { title: "Article" },
				matches: [{ index: 0 }],
				isSession: false,
			},
			{
				docId: "2",
				tag: { title: "Session" },
				matches: [{ index: 0 }],
				isSession: true,
			},
		];
		mockResearchState.source = "articles";
		renderResearch();
		expect(screen.getByText(/1 result/i)).toBeInTheDocument();
	});

	it("selects a results outline item", async () => {
		mockResearchState.results = [
			{ docId: "1", tag: { title: "Grace" }, matches: [{ index: 0 }] },
			{ docId: "2", tag: { title: "Hope" }, matches: [{ index: 1 }] },
		];
		renderResearch();
		const indicator = await screen.findByRole("button", {
			name: /Article 1 \/ 1/,
		});
		fireEvent.click(indicator);
		fireEvent.click(screen.getByRole("menuitem", { name: "Hope" }));
		expect(
			screen.queryByRole("menu", { name: "Results list" }),
		).not.toBeInTheDocument();
	});

	it("shows collapsed search summary with filter count", () => {
		mockResearchState.query = "grace";
		mockResearchState.filterTags = [{ type: "topic", label: "Grace" }];
		renderResearch();
		fireEvent.click(screen.getByRole("button", { name: "Hide Search" }));
		expect(screen.getByText(/grace/i)).toBeInTheDocument();
		expect(screen.getByText(/1 Filters/i)).toBeInTheDocument();
	});

	it("loads a legacy JSON index when binary is missing", async () => {
		const storage = require("@util/storage/storage");
		mockResearchState.hasSearched = false;
		mockResearchState.results = [];
		storage.exists.mockImplementation((path) =>
			Promise.resolve(path.endsWith("search_index.json")),
		);
		storage.readFile.mockResolvedValue(
			JSON.stringify({ v: 4, f: [], d: [], t: {} }),
		);

		renderResearch();
		await waitFor(() => {
			expect(screen.getByText("Find ideas")).toBeInTheDocument();
		});
	});

	it("sanitizes retired transcription filter tags on load", () => {
		mockResearchState.filterTags = [
			{ type: "source", label: "Transcriptions", id: "TRANSCRIPTIONS" },
			{ type: "topic", label: "Grace" },
		];
		mockResearchState.hasSearched = true;
		renderResearch();
		expect(
			mockResearchState.filterTags.every((t) => t.id !== "TRANSCRIPTIONS"),
		).toBe(true);
	});

	it("shows active filter chips and removes one on delete", () => {
		mockResearchState.filterTags = [{ type: "topic", label: "Grace" }];
		useTranslations.mockReturnValue({
			RESEARCH: "Research",
			SESSIONS: "Sessions",
			ARTICLES: "Articles",
			SUMMARIES: "Summaries",
			INDEXING: "Indexing...",
			SEARCH: "Search",
			SEARCH_ARTICLES: "Search...",
			ALL: "All",
			FILTERS: "Filters",
			SEARCH_FILTERS: "Search filters...",
			CLOSE: "Close",
			DONE: "Done",
			CLEAR_ALL: "Clear all",
			CLEAR: "Clear search",
			RESEARCH_HELP: "Search your library",
			SEARCH_HINT: "Use quotes for a phrase",
			SHOW_SEARCH: "Show Search",
			HIDE_SEARCH: "Hide Search",
			RESEARCH_START: "Find ideas",
			RESEARCH_START_HELP: "Search by a word",
			RESEARCH_PREPARING: "Preparing Research",
			RESEARCH_INDEX_HELP: "Index is preparing",
			SUGGESTION_TITLE: "Title",
			SUGGESTION_FILTER: "Filter",
			SUGGESTION_TERM: "Term",
			ARTICLE: "Article",
			RESULTS_LIST: "Results list",
			MATCH: "matches",
			TOPIC: "Topic",
		});
		renderResearch();
		expect(screen.getByText(/Topic: Grace/)).toBeInTheDocument();
		const chipDelete = screen
			.getByText(/Topic: Grace/)
			.closest("div")
			?.querySelector("svg, button, [aria-label]");
		if (chipDelete) {
			fireEvent.click(chipDelete);
		}
	});

	it("falls back to empty search when query and filters are empty", async () => {
		const { decodeBinaryIndex } = require("@util/data/searchIndexBinary");
		const storage = require("@util/storage/storage");
		mockResearchState.query = "";
		mockResearchState.filterTags = [];
		mockResearchState.hasSearched = false;
		storage.exists.mockResolvedValue(true);
		storage.readFile.mockResolvedValue("binary-index");
		decodeBinaryIndex.mockReturnValue({ v: 5, f: ["a"], t: {} });

		renderResearch();
		await waitFor(() => {
			expect(screen.getByRole("button", { name: "Search" })).not.toBeDisabled();
		});
		fireEvent.click(screen.getByRole("button", { name: "Search" }));
		await waitFor(() => {
			expect(mockResearchState.hasSearched).toBe(true);
			expect(mockResearchState.results).toEqual([]);
		});
	});

	it("uses mobile device type without crashing", () => {
		useDeviceType.mockReturnValue("phone");
		renderResearch();
		expect(screen.getByTestId("virtual-list")).toBeInTheDocument();
	});

	describe("index lifecycle and sync", () => {
		it("auto-builds the index when no index files exist", async () => {
			const storage = require("@util/storage/storage");
			storage.exists.mockResolvedValue(false);
			mockResearchState.hasSearched = false;
			renderResearch();
			await waitFor(() => {
				expect(mockResearchState.indexing).toBe(true);
			});
		});

		it("deletes a corrupted index and rebuilds", async () => {
			const { decodeBinaryIndex } = require("@util/data/searchIndexBinary");
			const storage = require("@util/storage/storage");
			storage.exists.mockResolvedValue(true);
			storage.readFile.mockResolvedValue("bad-index");
			decodeBinaryIndex.mockImplementation(() => {
				throw new Error("corrupt");
			});
			mockResearchState.hasSearched = false;
			renderResearch();
			await waitFor(() => {
				expect(storage.deleteFile).toHaveBeenCalled();
				expect(mockResearchState.indexing).toBe(true);
			});
		});

		it("reloads index and tags when the library update counter changes", async () => {
			const { decodeBinaryIndex } = require("@util/data/searchIndexBinary");
			const storage = require("@util/storage/storage");
			storage.exists.mockResolvedValue(true);
			storage.readFile.mockResolvedValue("binary-index");
			decodeBinaryIndex.mockReturnValue({ v: 5, f: [], t: {} });
			const view = renderResearch();
			await waitFor(() => {
				expect(storage.readFile).toHaveBeenCalled();
			});
			const initialReads = storage.readFile.mock.calls.length;
			mockLibraryUpdateCounter = 1;
			view.rerender(
				<ContentSize.Provider value={mockSize}>
					<Research />
				</ContentSize.Provider>,
			);
			await waitFor(() => {
				expect(storage.readFile.mock.calls.length).toBeGreaterThan(
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
			storage.exists.mockResolvedValue(true);
			storage.readFile.mockResolvedValue("binary-index");
			decodeBinaryIndex.mockReturnValue({
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

	describe("session-derived filters", () => {
		it("loads session group, year, and type filters", async () => {
			const storage = require("@util/storage/storage");
			useSessions.mockReturnValue([
				[
					{
						name: "Grace study",
						group: "ai",
						year: "2024",
						type: "video",
					},
				],
			]);
			storage.exists.mockImplementation((path) =>
				Promise.resolve(path.endsWith("tags.json")),
			);
			storage.readFile.mockResolvedValue(JSON.stringify([]));
			renderResearch();
			fireEvent.click(screen.getByRole("button", { name: "Filters" }));
			await waitFor(() => {
				expect(screen.getByRole("button", { name: "AI" })).toBeInTheDocument();
			});
			expect(screen.getByRole("button", { name: "2024" })).toBeInTheDocument();
			expect(screen.getByRole("button", { name: "Video" })).toBeInTheDocument();
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
			storage.exists.mockResolvedValue(true);
			storage.readFile.mockResolvedValue("binary-index");
			decodeBinaryIndex.mockReturnValue({
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
			runResearchSearch.mockImplementation(
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
			useTranslations.mockReturnValue({
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
			runResearchSearch.mockResolvedValue({
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
			runResearchSearch.mockRejectedValue(new Error("search failed"));
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
			const initialCalls = runResearchSearch.mock.calls.length;
			useSessions.mockReturnValue([
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
			expect(runResearchSearch.mock.calls.length).toBeGreaterThan(initialCalls);
		});
	});

	describe("suggestions and filter chips", () => {
		it("adds a filter from a suggestion without duplicating", async () => {
			const storage = require("@util/storage/storage");
			const { decodeBinaryIndex } = require("@util/data/searchIndexBinary");
			mockResearchState.hasSearched = false;
			mockResearchState.filterTags = [{ type: "author", label: "Augustine" }];
			storage.exists.mockImplementation((path) =>
				Promise.resolve(
					path.endsWith("tags.json") || path.endsWith("search_index.bin"),
				),
			);
			storage.readFile.mockImplementation((path) =>
				path.endsWith("tags.json")
					? JSON.stringify([{ author: "Augustine", book: "Confessions" }])
					: "binary-index",
			);
			decodeBinaryIndex.mockReturnValue({ v: 5, f: [], t: { aug: ["aug"] } });
			const view = renderResearch();
			const searchInput = screen.getByPlaceholderText("Search...");
			fireEvent.focus(searchInput);
			fireEvent.change(searchInput, { target: { value: "aug" } });
			await waitFor(() => {
				view.rerender(
					<ContentSize.Provider value={mockSize}>
						<Research />
					</ContentSize.Provider>,
				);
			});
			const filterSuggestion = await screen.findByRole("option", {
				name: /Augustine/,
			});
			fireEvent.click(filterSuggestion);
			expect(mockResearchState.filterTags).toEqual([
				{ type: "author", label: "Augustine" },
			]);
		});

		it("clears active filter chips from the search panel", () => {
			mockResearchState.filterTags = [
				{ type: "topic", label: "Grace" },
				{ type: "topic", label: "Hope" },
			];
			useTranslations.mockReturnValue({
				RESEARCH: "Research",
				SESSIONS: "Sessions",
				ARTICLES: "Articles",
				SUMMARIES: "Summaries",
				SEARCH: "Search",
				SEARCH_ARTICLES: "Search...",
				ALL: "All",
				FILTERS: "Filters",
				CLEAR_ALL: "Clear all",
				HIDE_SEARCH: "Hide Search",
				RESEARCH_HELP: "Search your library",
				SEARCH_HINT: "Use quotes",
				TOPIC: "Topic",
			});
			renderResearch();
			const clearButtons = screen.getAllByRole("button", { name: "Clear all" });
			fireEvent.click(clearButtons[0]);
			expect(mockResearchState.filterTags).toEqual([]);
		});

		it("clears the filter list query in the drawer", async () => {
			const storage = require("@util/storage/storage");
			storage.exists.mockImplementation((path) =>
				Promise.resolve(path.endsWith("tags.json")),
			);
			storage.readFile.mockResolvedValue(
				JSON.stringify([{ author: "Augustine" }]),
			);
			renderResearch();
			fireEvent.click(screen.getByRole("button", { name: "Filters" }));
			const filterSearch =
				await screen.findByPlaceholderText("Search filters...");
			fireEvent.change(filterSearch, { target: { value: "aug" } });
			fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
			expect(filterSearch).toHaveValue("");
		});
	});

	describe("toolbar, jump, and print", () => {
		beforeEach(() => {
			jest.useFakeTimers();
		});

		afterEach(() => {
			jest.useRealTimers();
		});

		const getToolbarItems = () => {
			const { useToolbar } = require("@components/Toolbar");
			return useToolbar.mock.calls.at(-1)[0].items.filter(Boolean);
		};

		it("exposes admin rebuild and jump actions in the toolbar", () => {
			Cookies.get.mockReturnValue("admin");
			mockResearchState.indexing = false;
			useTranslations.mockReturnValue({
				RESEARCH: "Research",
				REBUILD_INDEX: "Rebuild index",
				JUMP_TO_ARTICLE: "Jump to article",
				PRINT: "Print",
				SHOW_SEARCH: "Show Search",
				HIDE_SEARCH: "Hide Search",
			});
			const view = renderResearch();
			const items = getToolbarItems();
			expect(items.find((item) => item.id === "rebuildIndex")).toBeTruthy();
			items.find((item) => item.id === "rebuildIndex").onClick();
			expect(mockResearchState.indexing).toBe(true);
			items.find((item) => item.id === "jump").onClick();
			view.rerender(
				<ContentSize.Provider value={mockSize}>
					<Research />
				</ContentSize.Provider>,
			);
			expect(screen.getByTestId("jump-dialog")).toBeInTheDocument();
		});

		it("submits jump dialog navigation for page and match", async () => {
			mockResearchState.results = [
				{ docId: "1", tag: { title: "Grace" }, matches: [{ index: 0 }] },
				{ docId: "2", tag: { title: "Hope" }, matches: [{ index: 0 }] },
			];
			const view = renderResearch();
			const items = getToolbarItems();
			items.find((item) => item.id === "jump").onClick();
			view.rerender(
				<ContentSize.Provider value={mockSize}>
					<Research />
				</ContentSize.Provider>,
			);
			fireEvent.click(screen.getByRole("button", { name: "jump-page" }));
			expect(mockListScrollToItem).toHaveBeenCalledWith(1, "start");
			getToolbarItems()
				.find((item) => item.id === "jump")
				.onClick();
			view.rerender(
				<ContentSize.Provider value={mockSize}>
					<Research />
				</ContentSize.Provider>,
			);
			fireEvent.click(screen.getByRole("button", { name: "jump-match" }));
			expect(mockLibraryState.scrollToParagraph).toBe(1);
		});

		it("prints results after preparing the print layout", () => {
			const printSpy = jest.spyOn(window, "print").mockImplementation(() => {});
			mockResearchState.results = [
				{
					docId: "1",
					tag: { title: "Grace", _id: "article-1" },
					text: "Grace abounds",
					matches: [{ index: 0 }],
				},
			];
			renderResearch();
			getToolbarItems()
				.find((item) => item.id === "print")
				.onClick();
			act(() => {
				jest.advanceTimersByTime(500);
			});
			expect(printSpy).toHaveBeenCalled();
			expect(document.getElementById("print-root")).toBeTruthy();
			printSpy.mockRestore();
		});

		it("toggles search collapse from the toolbar", () => {
			const view = renderResearch();
			expect(screen.getByPlaceholderText("Search...")).toBeInTheDocument();
			getToolbarItems()
				.find((item) => item.id === "toggleSearch")
				.onClick();
			view.rerender(
				<ContentSize.Provider value={mockSize}>
					<Research />
				</ContentSize.Provider>,
			);
			expect(
				screen.queryByPlaceholderText("Search..."),
			).not.toBeInTheDocument();
		});
	});

	describe("results list navigation", () => {
		beforeEach(() => {
			jest.useFakeTimers();
		});

		afterEach(() => {
			jest.useRealTimers();
		});

		const results = [
			{ docId: "1", tag: { title: "Grace" }, matches: [{ index: 0 }] },
			{ docId: "2", tag: { title: "Hope" }, matches: [{ index: 0 }] },
		];

		it("updates the URL when rendered items change", async () => {
			mockResearchState.results = results;
			renderResearch();
			await act(async () => {
				latestListProps.onItemsRendered({ visibleStartIndex: 0 });
				await Promise.resolve();
			});
			act(() => {
				latestListProps.onItemsRendered({ visibleStartIndex: 1 });
			});
			await waitFor(() => {
				expect(setPath).toHaveBeenCalledWith("research:2");
			});
		});

		it("scrolls to a deep-linked article number", async () => {
			mockResearchState.results = results;
			usePathItems.mockReturnValue(["research:2"]);
			renderResearch();
			await waitFor(() => {
				expect(mockListScrollToItem).toHaveBeenCalledWith(1, "start");
			});
		});

		it("scrolls when selecting from the results outline", async () => {
			mockResearchState.results = results;
			renderResearch();
			const indicator = await screen.findByRole("button", {
				name: /Article 1 \/ 1/,
			});
			fireEvent.click(indicator);
			fireEvent.click(screen.getByRole("menuitem", { name: "Hope" }));
			expect(mockListScrollToItem).toHaveBeenCalledWith(1, "start");
			act(() => {
				jest.advanceTimersByTime(1000);
			});
		});

		it("measures row heights and scrolls back to top", async () => {
			mockResearchState.results = results;
			renderResearch();
			expect(latestListProps.itemSize(0)).toBeGreaterThan(400);
			act(() => {
				latestListProps.itemData.setRowHeight(0, 100);
				latestListProps.itemData.setRowHeight(0, 200);
			});
			act(() => {
				jest.advanceTimersByTime(200);
			});
			expect(mockListResetAfterIndex).toHaveBeenCalled();
			act(() => {
				latestListProps.onItemsRendered({ visibleStartIndex: 2 });
			});
			const scrollTop = await screen.findByRole("button", {
				name: "scroll back to top",
			});
			fireEvent.click(scrollTop);
			expect(mockListScrollToItem).toHaveBeenCalledWith(0, "start");
		});

		it("collapses search on mobile when scrolling past the first result", async () => {
			useDeviceType.mockReturnValue("phone");
			mockResearchState.results = results;
			renderResearch();
			act(() => {
				latestListProps.onItemsRendered({ visibleStartIndex: 1 });
			});
			expect(
				screen.queryByPlaceholderText("Search..."),
			).not.toBeInTheDocument();
		});
	});

	describe("navigation helpers", () => {
		it("routes session and article titles through gotoArticle", async () => {
			mockResearchState.results = [
				{
					docId: "session|ai|2026|2026-01-01|Grace study",
					isSession: true,
					tag: {
						_id: "session|ai|2026|2026-01-01|Grace study",
						title: "Grace study",
					},
					matches: [{ index: 0 }],
				},
				{
					docId: "article-1",
					tag: { _id: "article-1", title: "Article" },
					matches: [{ index: 1 }],
				},
			];
			mockResearchState.hasSearched = true;
			renderResearch();
			await act(async () => {
				latestListProps.itemData.gotoArticle(
					{
						_id: "session|ai|2026|2026-01-01|Grace study",
						title: "Grace study",
					},
					0,
				);
				latestListProps.itemData.gotoArticle(
					{ _id: "article-1", title: "Article" },
					1,
				);
			});
			expect(setHash).toHaveBeenCalledWith(
				"session?group=ai&year=2026&date=2026-01-01&name=Grace%20study",
			);
			expect(setPath).toHaveBeenCalledWith("library", "id", "article-1:2");
		});
	});

	describe("branch coverage edge cases", () => {
		beforeEach(() => {
			jest.useFakeTimers();
		});

		afterEach(() => {
			jest.useRealTimers();
		});

		it("defaults source tab to all when store omits source", () => {
			delete mockResearchState.source;
			renderResearch();
			expect(screen.getByRole("tab", { name: "All" })).toHaveAttribute(
				"aria-selected",
				"true",
			);
		});

		it("loads filters when sessions is null", async () => {
			const storage = require("@util/storage/storage");
			useSessions.mockReturnValue([null]);
			storage.exists.mockImplementation((path) =>
				Promise.resolve(path.endsWith("tags.json")),
			);
			storage.readFile.mockResolvedValue(JSON.stringify([{ author: "Paul" }]));
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
			useSessions.mockReturnValue([
				[{ name: "Bare session", group: "", year: "", type: "" }],
			]);
			storage.exists.mockImplementation((path) =>
				Promise.resolve(path.endsWith("tags.json")),
			);
			storage.readFile.mockResolvedValue(JSON.stringify([]));
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
			storage.exists.mockResolvedValue(true);
			storage.readFile.mockRejectedValue(new Error("tags read failed"));
			renderResearch();
			await waitFor(() => {
				expect(logger.error).toHaveBeenCalledWith(
					"Failed to load tags for filters:",
					expect.any(Error),
				);
			});
		});

		it("does not update filters after unmount", async () => {
			const storage = require("@util/storage/storage");
			storage.exists.mockImplementation((path) =>
				Promise.resolve(path.endsWith("tags.json")),
			);
			storage.readFile.mockImplementation(
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
		});

		it("reports search progress from runResearchSearch callbacks", async () => {
			const { decodeBinaryIndex } = require("@util/data/searchIndexBinary");
			const storage = require("@util/storage/storage");
			const { runResearchSearch } = require("./runResearchSearch");
			mockResearchState.query = "grace";
			mockResearchState.hasSearched = false;
			storage.exists.mockResolvedValue(true);
			storage.readFile.mockResolvedValue("binary-index");
			decodeBinaryIndex.mockReturnValue({ v: 5, f: ["a"], t: {} });
			runResearchSearch.mockImplementation(async ({ onProgress }) => {
				onProgress(42);
				return {
					results: [{ docId: "1", matches: [{ index: 0 }] }],
					highlight: ["grace"],
					cancelled: false,
				};
			});
			useTranslations.mockReturnValue({
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
			storage.exists.mockResolvedValue(true);
			storage.readFile.mockResolvedValue("binary-index");
			decodeBinaryIndex.mockReturnValue({ v: 5, f: ["a"], t: {} });
			runResearchSearch.mockResolvedValue({
				results: [],
				highlight: [],
				cancelled: false,
			});
			useTranslations.mockReturnValue({
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

		it("omits admin rebuild action for non-admin users", () => {
			Cookies.get.mockReturnValue("student");
			useTranslations.mockReturnValue({
				RESEARCH: "Research",
				SHOW_SEARCH: "Show Search",
				HIDE_SEARCH: "Hide Search",
				JUMP_TO_ARTICLE: "Jump",
				PRINT: "Print",
			});
			renderResearch();
			const { useToolbar } = require("@components/Toolbar");
			const items = useToolbar.mock.calls.at(-1)[0].items.filter(Boolean);
			expect(items.find((item) => item.id === "rebuildIndex")).toBeUndefined();
		});

		it("uses fallback labels when translations omit panel toggle strings", () => {
			useTranslations.mockReturnValue({
				RESEARCH: "Research",
				SEARCH: "Search",
				SEARCH_ARTICLES: "Search...",
				ALL: "All",
				FILTERS: "Filters",
				HIDE_SEARCH: undefined,
				SHOW_SEARCH: undefined,
				RESEARCH_HELP: undefined,
				SEARCH_HINT: undefined,
			});
			renderResearch();
			expect(
				screen.getByRole("button", { name: "Hide Search" }),
			).toBeInTheDocument();
			fireEvent.click(screen.getByRole("button", { name: "Hide Search" }));
			expect(
				screen.getByRole("button", { name: "Show Search" }),
			).toBeInTheDocument();
		});

		it("shows singular result label for one match", () => {
			mockResearchState.results = [
				{
					docId: "1",
					tag: { title: "Only" },
					matches: [{ index: 0 }],
					isSession: false,
				},
			];
			useTranslations.mockReturnValue({
				RESEARCH: "Research",
				SESSIONS: "Sessions",
				ARTICLES: "Articles",
				SUMMARIES: "Summaries",
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
			expect(screen.getByText(/1 result · 1 matches/)).toBeInTheDocument();
		});

		it("ignores malformed session ids in gotoArticle", async () => {
			mockResearchState.results = [
				{
					docId: "session|short",
					tag: { _id: "session|short", title: "Bad" },
					matches: [{ index: 0 }],
				},
			];
			renderResearch();
			await act(async () => {
				latestListProps.itemData.gotoArticle(
					{ _id: "session|short", title: "Bad" },
					0,
				);
			});
			expect(setHash).not.toHaveBeenCalled();
		});

		it("navigates to library id without paragraph suffix", async () => {
			renderResearch();
			await act(async () => {
				latestListProps.itemData.gotoArticle({ _id: "article-1", title: "A" });
			});
			expect(setPath).toHaveBeenCalledWith("library", "id", "article-1");
		});

		it("skips page jump when target is out of range", async () => {
			mockResearchState.results = [
				{ docId: "1", tag: { title: "Only" }, matches: [{ index: 0 }] },
			];
			const view = renderResearch();
			const items = require("@components/Toolbar").useToolbar.mock.calls.at(
				-1,
			)[0].items;
			items.find((item) => item.id === "jump").onClick();
			view.rerender(
				<ContentSize.Provider value={mockSize}>
					<Research />
				</ContentSize.Provider>,
			);
			mockListScrollToItem.mockClear();
			fireEvent.click(screen.getByRole("button", { name: "jump-page" }));
			expect(mockListScrollToItem).not.toHaveBeenCalled();
		});

		it("ignores pending deep-link paths without scrolling again", async () => {
			mockResearchState.results = [
				{ docId: "1", tag: { title: "A" }, matches: [{ index: 0 }] },
				{ docId: "2", tag: { title: "B" }, matches: [{ index: 0 }] },
			];
			usePathItems.mockReturnValue(["research:1"]);
			renderResearch();
			await act(async () => {
				latestListProps.onItemsRendered({ visibleStartIndex: 0 });
				await Promise.resolve();
			});
			mockListScrollToItem.mockClear();
			usePathItems.mockReturnValue(["research:1"]);
			await act(async () => {
				jest.advanceTimersByTime(50);
				await Promise.resolve();
			});
			expect(mockListScrollToItem).not.toHaveBeenCalled();
		});

		it("uses cached row height in getItemSize", () => {
			mockResearchState.results = [
				{ docId: "1", tag: { title: "A" }, matches: [{ index: 0 }] },
			];
			renderResearch();
			act(() => {
				latestListProps.itemData.setRowHeight(0, 250);
				jest.advanceTimersByTime(200);
			});
			expect(latestListProps.itemSize(0)).toBe(250);
		});

		it("keeps page indicator visible while results outline is open", async () => {
			mockResearchState.results = [
				{ docId: "1", tag: { title: "Grace" }, matches: [{ index: 0 }] },
				{ docId: "2", tag: { title: "Hope" }, matches: [{ index: 0 }] },
			];
			renderResearch();
			const indicator = await screen.findByRole("button", {
				name: /Article 1 \/ 1/,
			});
			fireEvent.click(indicator);
			act(() => {
				jest.advanceTimersByTime(2000);
			});
			expect(
				screen.getByRole("button", { name: /Article 1 \/ 1/ }),
			).toBeInTheDocument();
		});

		it("prints articles using paragraph arrays when text is absent", () => {
			const printSpy = jest.spyOn(window, "print").mockImplementation(() => {});
			mockResearchState.results = [
				{
					docId: "1",
					tag: { title: "Grace", _id: "article-1" },
					paragraphs: ["Line one", "Line two"],
					matches: [{ index: 0 }, { index: 1 }],
				},
			];
			renderResearch();
			const items = require("@components/Toolbar").useToolbar.mock.calls.at(
				-1,
			)[0].items;
			items.find((item) => item.id === "print").onClick();
			act(() => {
				jest.advanceTimersByTime(500);
			});
			expect(printSpy).toHaveBeenCalled();
			printSpy.mockRestore();
		});

		it("removes print-root on unmount when it created the element", () => {
			const existing = document.getElementById("print-root");
			if (existing) existing.remove();
			const view = renderResearch();
			const created = document.getElementById("print-root");
			expect(created).toBeTruthy();
			view.unmount();
			expect(document.body.contains(created)).toBe(false);
		});

		it("keeps suggestions open when blur moves focus inside the query wrap", async () => {
			const storage = require("@util/storage/storage");
			storage.exists.mockImplementation((path) =>
				Promise.resolve(path.endsWith("tags.json")),
			);
			storage.readFile.mockResolvedValue(
				JSON.stringify([{ title: "Grace and peace" }]),
			);
			renderResearch();
			const searchInput = screen.getByPlaceholderText("Search...");
			fireEvent.focus(searchInput);
			fireEvent.change(searchInput, { target: { value: "gr" } });
			await waitFor(() => {
				expect(screen.getByRole("listbox")).toBeInTheDocument();
			});
			const suggestion = screen.getAllByRole("option")[0];
			fireEvent.blur(searchInput, { relatedTarget: suggestion });
			expect(screen.getByRole("listbox")).toBeInTheDocument();
		});

		it("renders print items with empty content when text and paragraphs are absent", () => {
			const printSpy = jest.spyOn(window, "print").mockImplementation(() => {});
			mockResearchState.results = [
				{
					docId: "1",
					tag: { title: "Empty", _id: "article-1" },
					matches: [{ index: 0 }],
				},
			];
			renderResearch();
			const items = require("@components/Toolbar").useToolbar.mock.calls.at(
				-1,
			)[0].items;
			items.find((item) => item.id === "print").onClick();
			act(() => {
				jest.advanceTimersByTime(500);
			});
			expect(printSpy).toHaveBeenCalled();
			printSpy.mockRestore();
		});

		it("searches on Enter when suggestions are closed", async () => {
			const { decodeBinaryIndex } = require("@util/data/searchIndexBinary");
			const storage = require("@util/storage/storage");
			mockResearchState.query = "grace";
			mockResearchState.hasSearched = false;
			storage.exists.mockResolvedValue(true);
			storage.readFile.mockResolvedValue("binary-index");
			decodeBinaryIndex.mockReturnValue({ v: 5, f: ["a"], t: {} });
			renderResearch();
			await act(async () => {
				await Promise.resolve();
			});
			const searchInput = screen.getByPlaceholderText("Search...");
			fireEvent.keyDown(searchInput, { key: "Enter" });
			await act(async () => {
				jest.runOnlyPendingTimers();
				await Promise.resolve();
			});
			expect(mockResearchState.hasSearched).toBe(true);
		});

		it("deselects an active filter from the drawer", async () => {
			const storage = require("@util/storage/storage");
			mockResearchState.filterTags = [{ type: "author", label: "Paul" }];
			storage.exists.mockImplementation((path) =>
				Promise.resolve(path.endsWith("tags.json")),
			);
			storage.readFile.mockResolvedValue(JSON.stringify([{ author: "Paul" }]));
			renderResearch();
			fireEvent.click(screen.getByRole("button", { name: "Filters (1)" }));
			await waitFor(() => {
				expect(
					screen.getByRole("button", { name: "Paul" }),
				).toBeInTheDocument();
			});
			fireEvent.click(screen.getByRole("button", { name: "Paul" }));
			expect(mockResearchState.filterTags).toEqual([]);
		});

		it("does not update scroll pages when rendered page is unchanged", async () => {
			mockResearchState.results = [
				{ docId: "1", tag: { title: "A" }, matches: [{ index: 0 }] },
			];
			renderResearch();
			await act(async () => {
				latestListProps.onItemsRendered({ visibleStartIndex: 0 });
				latestListProps.onItemsRendered({ visibleStartIndex: 0 });
				await Promise.resolve();
			});
		});

		it("logs when deleting a corrupted index also fails", async () => {
			const storage = require("@util/storage/storage");
			const { logger } = require("@util/api/logger");
			storage.exists.mockResolvedValue(true);
			storage.readFile.mockRejectedValue(new Error("corrupt"));
			storage.deleteFile.mockRejectedValue(new Error("delete failed"));
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

		it("hides scroll pages after scrolling when the outline is closed", async () => {
			mockResearchState.results = [
				{ docId: "1", tag: { title: "A" }, matches: [{ index: 0 }] },
			];
			renderResearch();
			await act(async () => {
				latestListProps.onItemsRendered({ visibleStartIndex: 2 });
				jest.advanceTimersByTime(1600);
				await Promise.resolve();
			});
		});
	});
});
