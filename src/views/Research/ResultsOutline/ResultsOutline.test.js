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
});
