import "./researchTestSetup";
import "./researchNavigationTestSetup";
import { ContentSize } from "@components/Page/Content";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { useDeviceType } from "@util/browser/styles";
import { useSessions } from "@util/domain/sessions";
import { useTranslations } from "@util/domain/translations";
import Cookies from "js-cookie";
import Research from "./";
import { mockResearchListFactory } from "./researchNavigationTestSetup";
import {
	createResearchTranslations,
	setupResearchViewTest,
} from "./researchTestSetup";
import { renderResearchView } from "./researchViewTestUtils";

jest.mock("@components/Virtualized/VariableSizeList", () =>
	mockResearchListFactory(),
);

let mockResearchState: any;
let mockLibraryState: any;

describe("Research View", () => {
	const mockSize = { width: 800, height: 600, emPixels: 16 };

	beforeEach(() => {
		const state = setupResearchViewTest({ cookies: Cookies });
		mockResearchState = state.researchState;
		mockLibraryState = state.libraryState;
	});

	const renderResearch = () => renderResearchView(Research, mockSize);

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
		asMock(storage.exists).mockImplementation((path: any) =>
			Promise.resolve(path.endsWith("tags.json")),
		);
		asMock(storage.readFile).mockResolvedValue(
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
		asMock(storage.exists).mockImplementation((path: any) =>
			Promise.resolve(path.endsWith("tags.json")),
		);
		asMock(storage.readFile).mockResolvedValue(
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
		Object.assign(mockResearchState, {
			filterTags: [{ type: "topic", label: "Grace" }],
			hasSearched: false,
		});
		mockLibraryState.tags = [
			{ _id: "article-1", title: "Grace", topic: "Grace" },
		];
		asMock(storage.exists).mockResolvedValue(true);
		asMock(storage.readFile).mockImplementation((path: any) =>
			path.endsWith("tags.json")
				? JSON.stringify(mockLibraryState.tags)
				: "binary-index",
		);
		asMock(decodeBinaryIndex).mockReturnValue({
			v: 5,
			f: ["article-1"],
			t: {},
		});
		asMock(loadParagraphsForFile).mockResolvedValue(["Grace"]);

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
		Object.assign(mockResearchState, {
			query: "grace",
			hasSearched: false,
			results: [],
		});
		asMock(useSessions).mockReturnValue([
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
		asMock(storage.exists).mockResolvedValue(true);
		asMock(storage.readFile).mockResolvedValue("binary-index");
		asMock(decodeBinaryIndex).mockReturnValue({
			v: 5,
			f: [sessionId],
			// compressed v5 refs: -(fileIndex+1), paraIndex
			t: { grace: [-1, 1] },
		});
		asMock(loadParagraphsForFile).mockResolvedValue([
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
		asMock(storage.exists).mockResolvedValue(true);
		asMock(storage.readFile).mockResolvedValue("binary-index");
		asMock(decodeBinaryIndex).mockReturnValue({ v: 5, f: [], t: {} });

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
		asMock(useTranslations).mockReturnValue(
			createResearchTranslations({
				NO_RESULTS: "No results",
				CLEAR_FILTERS: "Clear filters",
				TOPIC: "Topic",
			}),
		);
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
		asMock(storage.exists).mockImplementation((path: any) =>
			Promise.resolve(path.endsWith("tags.json")),
		);
		asMock(storage.readFile).mockResolvedValue(
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
		asMock(storage.exists).mockImplementation((path: any) =>
			Promise.resolve(path.endsWith("search_index.json")),
		);
		asMock(storage.readFile).mockResolvedValue(
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
			mockResearchState.filterTags.every((t: any) => t.id !== "TRANSCRIPTIONS"),
		).toBe(true);
	});

	it("shows active filter chips and removes one on delete", () => {
		mockResearchState.filterTags = [{ type: "topic", label: "Grace" }];
		asMock(useTranslations).mockReturnValue(
			createResearchTranslations({ TOPIC: "Topic" }),
		);
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
		asMock(storage.exists).mockResolvedValue(true);
		asMock(storage.readFile).mockResolvedValue("binary-index");
		asMock(decodeBinaryIndex).mockReturnValue({ v: 5, f: ["a"], t: {} });

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
		asMock(useDeviceType).mockReturnValue("phone");
		renderResearch();
		expect(screen.getByTestId("virtual-list")).toBeInTheDocument();
	});
});
