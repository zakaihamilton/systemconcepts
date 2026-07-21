import { fireEvent, render, screen } from "@testing-library/react";
import { normalizeContent, preprocessMarkdown } from "@util/data/string";
import SearchResultItem from "./SearchResultItem.js";

const mockArticle = jest.fn(({ hideContent, onTitleClick, content }) => (
	<div data-testid="article">
		<button type="button" data-testid="title" onClick={onTitleClick}>
			title
		</button>
		<span data-testid="content-state">
			{hideContent ? "hidden" : "visible"}
		</span>
		<span data-testid="content">{content}</span>
	</div>
));

jest.mock("@views/Library/Article", () => (props) => mockArticle(props));
jest.mock("@widgets/Tooltip", () => ({ children, title }) => (
	<div data-testid="tooltip" data-title={title}>
		{children}
	</div>
));
jest.mock("@util/data/string", () => ({
	normalizeContent: jest.fn((t) => `N:${t}`),
	preprocessMarkdown: jest.fn((t) => `P:${t}`),
}));

describe("SearchResultItem", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		global.ResizeObserver = jest.fn().mockImplementation((cb) => ({
			observe: jest.fn((el) => {
				cb([
					{
						target: {
							getBoundingClientRect: () => ({ height: 40 }),
						},
					},
				]);
			}),
			disconnect: jest.fn(),
			unobserve: jest.fn(),
		}));
	});

	const renderItem = (doc, extras = {}) => {
		const setRowHeight = jest.fn();
		const gotoArticle = jest.fn();
		const result = render(
			<SearchResultItem
				index={0}
				style={{}}
				data={{
					results: [doc],
					gotoArticle,
					setRowHeight,
					highlight: ["x"],
					translations: {
						ARTICLES: "Article",
						SESSIONS: "Session",
						MATCH: "matches",
						COLLAPSE_ARTICLE: "Collapse article",
						EXPAND_ARTICLE: "Expand article",
						COLLAPSE_SESSION: "Collapse session",
						EXPAND_SESSION: "Expand session",
					},
					...extras,
				}}
			/>,
		);
		return { ...result, setRowHeight, gotoArticle };
	};

	it("returns null without doc", () => {
		const { container } = render(
			<SearchResultItem index={0} style={{}} data={{ results: [] }} />,
		);
		expect(container.firstChild).toBeNull();
	});

	it("collapses and expands article content", () => {
		const doc = {
			docId: "article-1",
			isSession: false,
			matches: [{ index: 0 }],
			text: "Grace and peace",
			tag: { title: "Grace", _id: "article-1" },
		};
		renderItem(doc);
		expect(screen.getByTestId("content-state")).toHaveTextContent("visible");
		expect(normalizeContent).toHaveBeenCalledWith("Grace and peace");
		expect(mockArticle).toHaveBeenLastCalledWith(
			expect.objectContaining({
				filteredParagraphs: [1],
				hideContent: false,
			}),
		);

		fireEvent.click(screen.getByRole("button", { name: "Collapse article" }));
		expect(screen.getByTestId("content-state")).toHaveTextContent("hidden");
		expect(
			screen.getByRole("button", { name: "Expand article" }),
		).toHaveAttribute("aria-expanded", "false");
	});

	it("processes session paragraphs and disables filtering", () => {
		const doc = {
			docId: "s1",
			isSession: true,
			matches: [{ index: 0 }],
			paragraphs: ["Title", "Body one", "Body two"],
			tag: { title: "S" },
		};
		const { gotoArticle, setRowHeight } = renderItem(doc);
		expect(preprocessMarkdown).toHaveBeenCalled();
		expect(mockArticle).toHaveBeenLastCalledWith(
			expect.objectContaining({ filteredParagraphs: null }),
		);
		fireEvent.click(screen.getByTestId("title"));
		expect(gotoArticle).toHaveBeenCalledWith(doc.tag);
		expect(setRowHeight).toHaveBeenCalledWith(0, 44);
		fireEvent.click(screen.getByRole("button", { name: "Collapse session" }));
		expect(
			screen.getByRole("button", { name: "Expand session" }),
		).toBeInTheDocument();
	});

	it("handles missing matches and empty content", () => {
		renderItem({
			docId: "empty",
			isSession: false,
			tag: {},
		});
		expect(screen.getByText(/0 matches/)).toBeInTheDocument();
		expect(screen.getByTestId("content")).toHaveTextContent("");
	});

	it("uses fallback labels without translations", () => {
		render(
			<SearchResultItem
				index={0}
				style={{}}
				data={{
					results: [
						{ docId: "a", isSession: false, matches: [], text: "t", tag: {} },
					],
					gotoArticle: jest.fn(),
					setRowHeight: jest.fn(),
				}}
			/>,
		);
		expect(screen.getByText("Article")).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "Collapse article" }),
		).toBeInTheDocument();
	});

	it("skips resize observer when setRowHeight missing", () => {
		render(
			<SearchResultItem
				index={0}
				style={{}}
				data={{
					results: [{ docId: "a", text: "t", tag: {}, matches: [] }],
					gotoArticle: jest.fn(),
				}}
			/>,
		);
		expect(screen.getByTestId("article")).toBeInTheDocument();
	});

	it("passes custom tags through to Article", () => {
		renderItem({
			docId: "article-1",
			isSession: false,
			matches: [{ index: 0 }],
			text: "Grace",
			tag: { title: "Grace", _id: "article-1" },
			customTags: [{ label: "Topic", value: "Grace" }],
		});
		expect(mockArticle).toHaveBeenLastCalledWith(
			expect.objectContaining({
				customTags: [{ label: "Topic", value: "Grace" }],
			}),
		);
	});

	it("skips resize updates when measured height is zero", () => {
		global.ResizeObserver = jest.fn().mockImplementation((cb) => ({
			observe: jest.fn((el) => {
				cb([
					{
						target: {
							getBoundingClientRect: () => ({ height: 0 }),
						},
					},
				]);
			}),
			disconnect: jest.fn(),
			unobserve: jest.fn(),
		}));
		const { setRowHeight } = renderItem({
			docId: "article-1",
			isSession: false,
			matches: [{ index: 0 }],
			text: "Grace",
			tag: { title: "Grace" },
		});
		expect(setRowHeight).not.toHaveBeenCalled();
	});

	it("handles missing data and last-row layout", () => {
		const { container } = render(
			<SearchResultItem
				index={1}
				style={{}}
				data={{
					results: [
						{ docId: "first", text: "one", tag: {}, matches: [] },
						{ docId: "last", text: "two", tag: {}, matches: [] },
					],
					gotoArticle: jest.fn(),
					setRowHeight: jest.fn(),
				}}
			/>,
		);
		expect(container.querySelector(".separator")).not.toBeInTheDocument();
	});

	it("uses session fallback labels when translations are absent", () => {
		render(
			<SearchResultItem
				index={0}
				style={{}}
				data={{
					results: [
						{
							docId: "s1",
							isSession: true,
							paragraphs: ["Only title"],
							matches: [],
							tag: {},
						},
					],
					gotoArticle: jest.fn(),
					setRowHeight: jest.fn(),
				}}
			/>,
		);
		expect(screen.getByText("Session")).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "Collapse session" }),
		).toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: "Collapse session" }));
		expect(
			screen.getByRole("button", { name: "Expand session" }),
		).toBeInTheDocument();
	});

	it("renders with null data safely", () => {
		const { container } = render(
			<SearchResultItem index={0} style={{}} data={null} />,
		);
		expect(container.firstChild).toBeNull();
	});

	it("builds session content from paragraphs without a title row", () => {
		renderItem({
			docId: "s1",
			isSession: true,
			matches: [{ index: 0 }],
			paragraphs: ["Title", "Body paragraph"],
			tag: { title: "S" },
		});
		expect(preprocessMarkdown).toHaveBeenCalledWith("Body paragraph");
	});
});
