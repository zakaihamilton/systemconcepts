import { ContentSize } from "@components/Page/Content";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useDeviceType } from "@util/browser/styles";
import { useSessions } from "@util/domain/sessions";
import { useTranslations } from "@util/domain/translations";
import Cookies from "js-cookie";
import Research from "./";

let mockResearchState;
let mockLibraryState;

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
		useState: jest.fn().mockReturnValue(0),
	},
}));
jest.mock("@util/browser/styles");
jest.mock("@util/storage/storage", () => ({
	exists: jest.fn().mockResolvedValue(false),
	readFile: jest.fn().mockResolvedValue(""),
}));
jest.mock("@util/domain/views", () => ({
	setHash: jest.fn(),
	setPath: jest.fn(),
	usePathItems: jest.fn().mockReturnValue([]),
}));
jest.mock("@components/Virtualized/VariableSizeList", () => {
	const React = require("react");
	return React.forwardRef(function MockList(props, ref) {
		React.useImperativeHandle(ref, () => ({
			scrollToItem: jest.fn(),
			resetAfterIndex: jest.fn(),
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
jest.mock("js-cookie");

describe("Research View", () => {
	const mockSize = { width: 800, height: 600, emPixels: 16 };

	beforeEach(() => {
		jest.clearAllMocks();
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
			TRANSCRIPTIONS: "Transcriptions",
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
});
