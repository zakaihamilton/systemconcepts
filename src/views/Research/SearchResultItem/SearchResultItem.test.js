import { fireEvent, render, screen } from "@testing-library/react";
import SearchResultItem from "./SearchResultItem";

const mockArticle = jest.fn(({ hideContent }) => (
	<div data-testid="article">{hideContent ? "hidden" : "visible"}</div>
));

jest.mock("@views/Library/Article", () => (props) => mockArticle(props));
jest.mock("@widgets/Tooltip", () => ({ children, title }) => (
	<div data-testid="tooltip" data-title={title}>
		{children}
	</div>
));

describe("SearchResultItem", () => {
	const doc = {
		docId: "article-1",
		isSession: false,
		matches: [{ index: 0 }],
		text: "Grace and peace",
		tag: { title: "Grace", _id: "article-1" },
	};

	beforeEach(() => {
		jest.clearAllMocks();
		global.ResizeObserver = jest.fn().mockImplementation(() => ({
			observe: jest.fn(),
			disconnect: jest.fn(),
			unobserve: jest.fn(),
		}));
	});

	const renderItem = (translations = {}) =>
		render(
			<SearchResultItem
				index={0}
				style={{}}
				data={{
					results: [doc],
					gotoArticle: jest.fn(),
					setRowHeight: jest.fn(),
					highlight: [],
					translations: {
						ARTICLES: "Article",
						MATCH: "matches",
						COLLAPSE_ARTICLE: "Collapse article",
						EXPAND_ARTICLE: "Expand article",
						...translations,
					},
				}}
			/>,
		);

	it("collapses and expands article content with a rotating toggle", () => {
		renderItem();

		expect(screen.getByTestId("article")).toHaveTextContent("visible");
		expect(mockArticle).toHaveBeenLastCalledWith(
			expect.objectContaining({ hideContent: false }),
		);

		const toggle = screen.getByRole("button", { name: "Collapse article" });
		expect(toggle).toHaveAttribute("aria-expanded", "true");
		expect(screen.getByTestId("tooltip")).toHaveAttribute(
			"data-title",
			"Collapse article",
		);

		fireEvent.click(toggle);

		expect(screen.getByTestId("article")).toHaveTextContent("hidden");
		expect(mockArticle).toHaveBeenLastCalledWith(
			expect.objectContaining({ hideContent: true }),
		);
		expect(
			screen.getByRole("button", { name: "Expand article" }),
		).toHaveAttribute("aria-expanded", "false");
		expect(screen.getByTestId("tooltip")).toHaveAttribute(
			"data-title",
			"Expand article",
		);
	});
});
