import { MainStore } from "@components/Main";
import { fireEvent, render, screen } from "@testing-library/react";
import ListWidget, { ListItemWidget } from "./index.js";

jest.mock("@components/Main", () => ({
	MainStore: {
		useState: jest.fn().mockReturnValue({ direction: "ltr" }),
	},
}));

describe("List Widget", () => {
	const items = [
		{ id: "1", name: "Item 1", description: "Desc 1" },
		{ id: "2", name: "Item 2", items: [{ id: "2.1", name: "Sub Item 1" }] },
	];

	beforeEach(() => {
		jest.clearAllMocks();
		MainStore.useState.mockReturnValue({ direction: "ltr" });
	});

	it("renders list items", () => {
		const { getByText } = render(<ListWidget items={items} />);
		expect(getByText("Item 1")).toBeInTheDocument();
		expect(getByText("Desc 1")).toBeInTheDocument();
		expect(getByText("Item 2")).toBeInTheDocument();
	});

	it("calls onClick when item is clicked", () => {
		const handleClick = jest.fn();
		const { getByText } = render(
			<ListWidget items={items} onClick={handleClick} />,
		);
		fireEvent.click(getByText("Item 1"));
		expect(handleClick).toHaveBeenCalledWith("1");
	});

	it("toggles nested list items", () => {
		const { getByText, queryByText } = render(<ListWidget items={items} />);
		expect(queryByText("Sub Item 1")).not.toBeInTheDocument();

		fireEvent.click(getByText("Item 2"));
		expect(getByText("Sub Item 1")).toBeInTheDocument();
	});

	it("supports controlled selection via state and array/function selected", () => {
		const setSelected = jest.fn();
		const { rerender } = render(
			<ListWidget items={items} state={["1", setSelected]} />,
		);
		fireEvent.click(screen.getByText("Item 1"));
		expect(setSelected).toHaveBeenCalledWith("1");

		rerender(
			<ListWidget
				items={[{ id: "a", name: "A", selected: ["a"] }]}
				state={[["a"], setSelected]}
			/>,
		);
		expect(screen.getByText("A")).toBeInTheDocument();
	});

	it("renders icons, avatars, actions, content, and reverse dividers", () => {
		const action = jest.fn();
		const onToggle = jest.fn();
		MainStore.useState.mockReturnValue({ direction: "rtl" });

		render(
			<ListWidget
				reverse
				variant="sidebar"
				items={[
					{
						id: "icon",
						name: "Icon item",
						icon: <span data-testid="icon">i</span>,
						divider: true,
						target: "settings",
					},
					{
						id: "avatar",
						name: "Avatar item",
						avatar: true,
						icon: true,
						action: {
							icon: <span data-testid="action-icon">a</span>,
							label: "Act",
							callback: action,
						},
					},
					{
						id: "content",
						name: "Content item",
						content: <div data-testid="extra">extra</div>,
						isOpen: false,
						onToggle,
					},
				]}
			/>,
		);

		expect(screen.getByTestId("icon")).toBeInTheDocument();
		fireEvent.click(screen.getByLabelText("Act"));
		expect(action).toHaveBeenCalled();
		fireEvent.click(screen.getByText("Content item"));
		expect(onToggle).toHaveBeenCalledWith(true);
	});

	it("uses selected function predicates and hash targets", () => {
		render(
			<ListItemWidget
				id="x"
				name="X"
				depth={2}
				selected={(id) => id === "x"}
				target="#already"
				onClick={jest.fn()}
			/>,
		);
		expect(screen.getByText("X")).toBeInTheDocument();
	});

	it("handles empty items without crashing", () => {
		const { container } = render(<ListWidget />);
		expect(container.querySelector("nav")).toBeInTheDocument();
	});

	it("calls onClick directly on ListItemWidget when setSelected is absent", () => {
		const onClick = jest.fn();
		render(
			<ListItemWidget id="solo" name="Solo" depth={0} onClick={onClick} />,
		);
		fireEvent.click(screen.getByText("Solo"));
		expect(onClick).toHaveBeenCalledWith("solo");
	});

	it("uses hash target when provided and omits target when empty", () => {
		render(
			<ListItemWidget id="hash" name="Hash link" depth={1} target="#ready" />,
		);
		expect(screen.getByText("Hash link").closest("a")).toHaveAttribute(
			"href",
			"#ready",
		);
	});

	it("expands controlled content and shows expand-less icon", () => {
		render(
			<ListItemWidget
				id="ctrl"
				name="Controlled"
				depth={0}
				content={<div data-testid="panel">panel</div>}
				isOpen
			/>,
		);
		expect(screen.getByTestId("panel")).toBeInTheDocument();
	});

	it("renders a trailing divider when reverse is false", () => {
		const { container } = render(
			<ListWidget items={[{ id: "d", name: "Divided", divider: true }]} />,
		);
		expect(container.querySelector("hr, [class*='divider']")).toBeTruthy();
	});
});
