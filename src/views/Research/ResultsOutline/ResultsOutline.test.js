import { fireEvent, render, screen } from "@testing-library/react";
import ResultsOutline from "./ResultsOutline";

jest.mock(
	"@ui/Menu",
	() =>
		({ open, children, "aria-label": ariaLabel }) =>
			open ? (
				<div role="menu" aria-label={ariaLabel}>
					{children}
				</div>
			) : null,
);
jest.mock("@ui/MenuItem", () => ({ children, onClick, selected, ...props }) => (
	<button
		type="button"
		role="menuitem"
		aria-current={selected ? "true" : undefined}
		onClick={onClick}
		{...props}
	>
		{children}
	</button>
));

describe("ResultsOutline", () => {
	const results = [
		{
			docId: "a1",
			isSession: false,
			tag: { title: "Grace" },
			matches: [{ index: 0 }, { index: 2 }],
		},
		{
			docId: "s1",
			isSession: true,
			name: "Hope study",
			tag: { title: "Hope study" },
			matches: [{ index: 1 }],
		},
	];

	it("lists result titles without content and selects a row", () => {
		const onSelect = jest.fn();
		render(
			<ResultsOutline
				open
				anchorEl={document.createElement("button")}
				onClose={jest.fn()}
				results={results}
				currentIndex={1}
				onSelect={onSelect}
				translations={{
					ARTICLES: "Article",
					SESSIONS: "Session",
					MATCH: "matches",
					RESULTS_LIST: "Results list",
				}}
			/>,
		);

		expect(
			screen.getByRole("menu", { name: "Results list" }),
		).toBeInTheDocument();
		expect(screen.getByText("Grace")).toBeInTheDocument();
		expect(screen.getByText("Hope study")).toBeInTheDocument();
		expect(screen.getByText(/Article · 2 matches/)).toBeInTheDocument();
		expect(screen.getByText(/Session · 1 matches/)).toBeInTheDocument();
		expect(screen.queryByText(/Grace abounds/)).not.toBeInTheDocument();

		const selected = screen.getByRole("menuitem", { name: /Hope study/ });
		expect(selected).toHaveAttribute("aria-current", "true");

		fireEvent.click(screen.getByRole("menuitem", { name: /Grace/ }));
		expect(onSelect).toHaveBeenCalledWith(0);
	});

	it("uses fallback labels and scrolls the current item into view", () => {
		const scrollIntoView = jest.fn();
		Element.prototype.scrollIntoView = scrollIntoView;

		render(
			<ResultsOutline
				open
				anchorEl={document.createElement("button")}
				results={[
					{ isSession: true, matches: [] },
					{ name: "Only name", matches: null },
				]}
				currentIndex={0}
			/>,
		);

		expect(
			screen.getByRole("menu", { name: "Results list" }),
		).toBeInTheDocument();
		expect(screen.getByText(/Session · 0 matches/)).toBeInTheDocument();
		expect(screen.getByText("Only name")).toBeInTheDocument();
		expect(scrollIntoView).toHaveBeenCalledWith({ block: "nearest" });
	});

	it("does not scroll when closed", () => {
		const scrollIntoView = jest.fn();
		Element.prototype.scrollIntoView = scrollIntoView;
		render(
			<ResultsOutline
				open={false}
				anchorEl={document.createElement("button")}
				results={results}
				currentIndex={0}
			/>,
		);
		expect(scrollIntoView).not.toHaveBeenCalled();
	});

	it("tolerates missing onSelect", () => {
		render(
			<ResultsOutline
				open
				anchorEl={document.createElement("button")}
				results={[{ tag: { title: "X" }, matches: [{}] }]}
			/>,
		);
		fireEvent.click(screen.getByRole("menuitem"));
	});

	it("renders nothing for the default empty results list", () => {
		render(<ResultsOutline open anchorEl={document.createElement("button")} />);
		expect(screen.getByRole("menu")).toBeInTheDocument();
		expect(screen.queryByRole("menuitem")).not.toBeInTheDocument();
	});

	it("uses doc.name when tag title is missing", () => {
		render(
			<ResultsOutline
				open
				anchorEl={document.createElement("button")}
				results={[{ docId: "n1", name: "Named only", matches: [] }]}
			/>,
		);
		expect(screen.getByText("Named only")).toBeInTheDocument();
	});
});
