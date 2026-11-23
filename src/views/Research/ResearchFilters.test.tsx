import "./researchTestSetup";
import "./researchMinimalTestSetup";
import { ContentSize } from "@components/Page/Content";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { useTranslations } from "@util/domain/translations";
import Cookies from "js-cookie";
import Research from "./";
import {
	createResearchScenarioTranslations,
	setupResearchViewTest,
} from "./researchTestSetup";
import { renderResearchView } from "./researchViewTestUtils";

let mockResearchState: any;

describe("Research View Suggestions and Filter Interactions", () => {
	const mockSize = { width: 800, height: 600, emPixels: 16 };

	beforeEach(() => {
		mockResearchState = setupResearchViewTest({
			cookies: Cookies,
		}).researchState;
	});

	const renderResearch = () => renderResearchView(Research, mockSize);

	describe("suggestions and filter chips", () => {
		it("adds a filter from a suggestion without duplicating", async () => {
			const storage = require("@util/storage/storage");
			const { decodeBinaryIndex } = require("@util/data/searchIndexBinary");
			mockResearchState.hasSearched = false;
			mockResearchState.filterTags = [{ type: "author", label: "Augustine" }];
			asMock(storage.exists).mockImplementation((path: any) =>
				Promise.resolve(
					path.endsWith("tags.json") || path.endsWith("search_index.bin"),
				),
			);
			asMock(storage.readFile).mockImplementation((path: any) =>
				path.endsWith("tags.json")
					? JSON.stringify([{ author: "Augustine", book: "Confessions" }])
					: "binary-index",
			);
			asMock(decodeBinaryIndex).mockReturnValue({
				v: 5,
				f: [],
				t: { aug: ["aug"] },
			});
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
			asMock(useTranslations).mockReturnValue(
				createResearchScenarioTranslations({
					CLEAR_ALL: "Clear all",
					TOPIC: "Topic",
				}),
			);
			renderResearch();
			const clearButtons = screen.getAllByRole("button", { name: "Clear all" });
			fireEvent.click(clearButtons[0]);
			expect(mockResearchState.filterTags).toEqual([]);
		});

		it("clears the filter list query in the drawer", async () => {
			const storage = require("@util/storage/storage");
			asMock(storage.exists).mockImplementation((path: any) =>
				Promise.resolve(path.endsWith("tags.json")),
			);
			asMock(storage.readFile).mockResolvedValue(
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

	describe("search and filter edge cases", () => {
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

		it("uses fallback labels when translations omit panel toggle strings", () => {
			asMock(useTranslations).mockReturnValue({
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
			asMock(useTranslations).mockReturnValue(
				createResearchScenarioTranslations({
					RESULT: "result",
					RESULTS: "results",
					MATCH: "matches",
					ARTICLE: "Article",
				}),
			);
			renderResearch();
			expect(screen.getByText(/1 result · 1 matches/)).toBeInTheDocument();
		});

		it("keeps suggestions open when blur moves focus inside the query wrap", async () => {
			const storage = require("@util/storage/storage");
			asMock(storage.exists).mockImplementation((path: any) =>
				Promise.resolve(path.endsWith("tags.json")),
			);
			asMock(storage.readFile).mockResolvedValue(
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

		it("searches on Enter when suggestions are closed", async () => {
			const { decodeBinaryIndex } = require("@util/data/searchIndexBinary");
			const storage = require("@util/storage/storage");
			mockResearchState.query = "grace";
			mockResearchState.hasSearched = false;
			asMock(storage.exists).mockResolvedValue(true);
			asMock(storage.readFile).mockResolvedValue("binary-index");
			asMock(decodeBinaryIndex).mockReturnValue({ v: 5, f: ["a"], t: {} });
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
			asMock(storage.exists).mockImplementation((path: any) =>
				Promise.resolve(path.endsWith("tags.json")),
			);
			asMock(storage.readFile).mockResolvedValue(
				JSON.stringify([{ author: "Paul" }]),
			);
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
	});
});
