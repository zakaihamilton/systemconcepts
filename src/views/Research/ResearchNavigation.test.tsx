import "./researchTestSetup";
import "./researchNavigationTestSetup";
import { ContentSize } from "@components/Page/Content";
import {
	act,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { useDeviceType } from "@util/browser/styles";
import { useTranslations } from "@util/domain/translations";
import { setHash, setPath, usePathItems } from "@util/domain/views";
import Cookies from "js-cookie";
import Research from "./";
import { setupResearchViewTest } from "./researchTestSetup";

let mockResearchState: any;
let mockLibraryState: any;
const mockListScrollToItem = jest.fn();
const mockListResetAfterIndex = jest.fn();
let latestListProps: any;

jest.mock("@components/Virtualized/VariableSizeList", () => {
	const React = require("react");
	return React.forwardRef(function MockList(props: any, ref: any) {
		latestListProps = props;
		React.useImperativeHandle(ref, () => ({
			scrollToItem: mockListScrollToItem,
			resetAfterIndex: mockListResetAfterIndex,
		}));
		return <div data-testid="virtual-list" />;
	});
});
describe("Research View Toolbar, Print, and Navigation", () => {
	const mockSize = { width: 800, height: 600, emPixels: 16 };

	beforeEach(() => {
		const state = setupResearchViewTest({
			cookies: Cookies,
			resetAdditionalState: () => {
				latestListProps = null;
			},
		});
		mockResearchState = state.researchState;
		mockLibraryState = state.libraryState;
	});

	const renderResearch = () =>
		render(
			<ContentSize.Provider value={mockSize}>
				<Research />
			</ContentSize.Provider>,
		);

	describe("toolbar, jump, and print", () => {
		beforeEach(() => {
			jest.useFakeTimers();
		});

		afterEach(() => {
			jest.useRealTimers();
		});

		const getToolbarItems = () => {
			const { useToolbar } = require("@components/Toolbar");
			return asMock(useToolbar).mock.calls.at(-1)[0].items.filter(Boolean);
		};

		it("exposes admin rebuild and jump actions in the toolbar", () => {
			asMock(Cookies.get).mockReturnValue("admin");
			mockResearchState.indexing = false;
			asMock(useTranslations).mockReturnValue({
				RESEARCH: "Research",
				REBUILD_INDEX: "Rebuild index",
				JUMP_TO_ARTICLE: "Jump to article",
				PRINT: "Print",
				SHOW_SEARCH: "Show Search",
				HIDE_SEARCH: "Hide Search",
			});
			const view = renderResearch();
			const items = getToolbarItems();
			expect(
				items.find((item: any) => item.id === "rebuildIndex"),
			).toBeTruthy();
			items.find((item: any) => item.id === "rebuildIndex").onClick();
			expect(mockResearchState.indexing).toBe(true);
			items.find((item: any) => item.id === "jump").onClick();
			view.rerender(
				<ContentSize.Provider value={mockSize}>
					<Research />
				</ContentSize.Provider>,
			);
			expect(screen.getByTestId("jump-dialog")).toBeInTheDocument();
		});

		it("omits admin rebuild action for non-admin users", () => {
			asMock(Cookies.get).mockReturnValue("student");
			asMock(useTranslations).mockReturnValue({
				RESEARCH: "Research",
				SHOW_SEARCH: "Show Search",
				HIDE_SEARCH: "Hide Search",
				JUMP_TO_ARTICLE: "Jump",
				PRINT: "Print",
			});
			renderResearch();
			const items = getToolbarItems();
			expect(
				items.find((item: any) => item.id === "rebuildIndex"),
			).toBeUndefined();
		});

		it("submits jump dialog navigation for page and match", async () => {
			mockResearchState.results = [
				{ docId: "1", tag: { title: "Grace" }, matches: [{ index: 0 }] },
				{ docId: "2", tag: { title: "Hope" }, matches: [{ index: 0 }] },
			];
			const view = renderResearch();
			const items = getToolbarItems();
			items.find((item: any) => item.id === "jump").onClick();
			view.rerender(
				<ContentSize.Provider value={mockSize}>
					<Research />
				</ContentSize.Provider>,
			);
			fireEvent.click(screen.getByRole("button", { name: "jump-page" }));
			expect(mockListScrollToItem).toHaveBeenCalledWith(1, "start");
			getToolbarItems()
				.find((item: any) => item.id === "jump")
				.onClick();
			view.rerender(
				<ContentSize.Provider value={mockSize}>
					<Research />
				</ContentSize.Provider>,
			);
			fireEvent.click(screen.getByRole("button", { name: "jump-match" }));
			expect(mockLibraryState.scrollToParagraph).toBe(1);
		});

		it("skips page jump when target is out of range", async () => {
			mockResearchState.results = [
				{ docId: "1", tag: { title: "Only" }, matches: [{ index: 0 }] },
			];
			const view = renderResearch();
			getToolbarItems()
				.find((item: any) => item.id === "jump")
				.onClick();
			view.rerender(
				<ContentSize.Provider value={mockSize}>
					<Research />
				</ContentSize.Provider>,
			);
			asMock(mockListScrollToItem).mockClear();
			fireEvent.click(screen.getByRole("button", { name: "jump-page" }));
			expect(mockListScrollToItem).not.toHaveBeenCalled();
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
				.find((item: any) => item.id === "print")
				.onClick();
			act(() => {
				jest.advanceTimersByTime(500);
			});
			expect(printSpy).toHaveBeenCalled();
			expect(document.getElementById("print-root")).toBeTruthy();
			asMock(printSpy).mockRestore();
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
			getToolbarItems()
				.find((item: any) => item.id === "print")
				.onClick();
			act(() => {
				jest.advanceTimersByTime(500);
			});
			expect(printSpy).toHaveBeenCalled();
			asMock(printSpy).mockRestore();
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
			getToolbarItems()
				.find((item: any) => item.id === "print")
				.onClick();
			act(() => {
				jest.advanceTimersByTime(500);
			});
			expect(printSpy).toHaveBeenCalled();
			asMock(printSpy).mockRestore();
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

		it("toggles search collapse from the toolbar", () => {
			const view = renderResearch();
			expect(screen.getByPlaceholderText("Search...")).toBeInTheDocument();
			getToolbarItems()
				.find((item: any) => item.id === "toggleSearch")
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
			asMock(usePathItems).mockReturnValue(["research:2"]);
			renderResearch();
			await waitFor(() => {
				expect(mockListScrollToItem).toHaveBeenCalledWith(1, "start");
			});
		});

		it("ignores pending deep-link paths without scrolling again", async () => {
			mockResearchState.results = results;
			asMock(usePathItems).mockReturnValue(["research:1"]);
			renderResearch();
			await act(async () => {
				latestListProps.onItemsRendered({ visibleStartIndex: 0 });
				await Promise.resolve();
			});
			asMock(mockListScrollToItem).mockClear();
			asMock(usePathItems).mockReturnValue(["research:1"]);
			await act(async () => {
				jest.advanceTimersByTime(50);
				await Promise.resolve();
			});
			expect(mockListScrollToItem).not.toHaveBeenCalled();
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

		it("keeps page indicator visible while results outline is open", async () => {
			mockResearchState.results = results;
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

		it("collapses search on mobile when scrolling past the first result", async () => {
			asMock(useDeviceType).mockReturnValue("phone");
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
	});
});
