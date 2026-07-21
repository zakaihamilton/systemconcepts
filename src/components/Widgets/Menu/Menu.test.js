import { fireEvent, render, screen } from "@testing-library/react";
import MenuWidget from "./index.js";

describe("Menu Widget", () => {
	const items = [
		{ id: "1", name: "Item 1" },
		{ id: "2", name: "Item 2", items: [{ id: "2.1", name: "Sub Item 1" }] },
	];

	it("renders children and opens menu on click", () => {
		const { getByText, queryByText } = render(
			<MenuWidget items={items}>
				<button>Open Menu</button>
			</MenuWidget>,
		);

		expect(queryByText("Item 1")).not.toBeInTheDocument();

		fireEvent.click(getByText("Open Menu"));
		expect(getByText("Item 1")).toBeInTheDocument();
		expect(getByText("Item 2")).toBeInTheDocument();
	});

	it("calls item onClick when a menu item is clicked", () => {
		const handleClick = jest.fn();
		const itemsWithClick = [{ id: "1", name: "Item 1", onClick: handleClick }];
		const { getByText } = render(
			<MenuWidget items={itemsWithClick}>
				<button>Open Menu</button>
			</MenuWidget>,
		);

		fireEvent.click(getByText("Open Menu"));
		fireEvent.click(getByText("Item 1"));

		expect(handleClick).toHaveBeenCalled();
	});

	it("expands nested items without onClick", () => {
		const scrollIntoView = jest.fn();
		Element.prototype.scrollIntoView = scrollIntoView;
		render(
			<MenuWidget items={items}>
				<button>Open Menu</button>
			</MenuWidget>,
		);
		fireEvent.click(screen.getByText("Open Menu"));
		fireEvent.click(screen.getByText("Item 2"));
		expect(screen.getByText("Sub Item 1")).toBeInTheDocument();
	});

	it("renders checkbox and radio selectors", () => {
		render(
			<MenuWidget
				items={[
					{ id: "c1", name: "Check", checked: true },
					{ id: "r1", name: "Radio", radio: true },
					{ id: "r2", name: "Radio off", radio: false },
					{ id: "c2", name: "Unchecked", checked: false },
				]}
			>
				<button>Open</button>
			</MenuWidget>,
		);
		fireEvent.click(screen.getByText("Open"));
		expect(screen.getByText("Check")).toBeInTheDocument();
		expect(screen.getByText("Radio")).toBeInTheDocument();
	});

	it("renders headers, dividers, icons, and descriptions", () => {
		render(
			<MenuWidget
				items={[
					{
						id: "h",
						name: "Header",
						header: true,
						items: [{ id: "h1", name: "Child" }],
					},
					{
						id: "d",
						name: "After",
						divider: true,
						icon: <span data-testid="icon" />,
					},
					{ id: "desc", name: "With desc", description: "More info" },
				]}
			>
				<button>Open</button>
			</MenuWidget>,
		);
		fireEvent.click(screen.getByText("Open"));
		expect(screen.getByText("Header")).toBeInTheDocument();
		fireEvent.click(screen.getByText("Header"));
		expect(screen.getByText("Child")).toBeInTheDocument();
		expect(screen.getByText("More info")).toBeInTheDocument();
	});

	it("supports controlled open/close", () => {
		const onClose = jest.fn();
		const onVisible = jest.fn();
		const { rerender } = render(
			<MenuWidget
				items={items}
				open
				anchorEl={document.body}
				onClose={onClose}
				onVisible={onVisible}
			>
				<button>Open</button>
			</MenuWidget>,
		);
		expect(screen.getByText("Item 1")).toBeInTheDocument();
		fireEvent.click(screen.getByText("Item 1"));
		expect(onClose).toHaveBeenCalled();

		rerender(
			<MenuWidget items={items} open={false} anchorEl={null} onClose={onClose}>
				<button>Open</button>
			</MenuWidget>,
		);
	});

	it("calls onClick when there are no items", () => {
		const onClick = jest.fn();
		render(
			<MenuWidget items={[]} onClick={onClick}>
				<button>Open</button>
			</MenuWidget>,
		);
		fireEvent.click(screen.getByText("Open"));
		expect(onClick).toHaveBeenCalled();
	});

	it("supports selected array without closing", () => {
		const handleClick = jest.fn();
		render(
			<MenuWidget
				items={[{ id: "1", name: "Item 1", onClick: handleClick }]}
				selected={["1"]}
			>
				<button>Open</button>
			</MenuWidget>,
		);
		fireEvent.click(screen.getByText("Open"));
		fireEvent.click(screen.getByText("Item 1"));
		expect(handleClick).toHaveBeenCalled();
	});

	it("respects highlight override", () => {
		render(
			<MenuWidget
				items={[{ id: "1", name: "Item 1", highlight: true }]}
				selected="other"
			>
				<button>Open</button>
			</MenuWidget>,
		);
		fireEvent.click(screen.getByText("Open"));
		expect(screen.getByText("Item 1")).toBeInTheDocument();
	});

	it("renders link targets", () => {
		render(
			<MenuWidget
				items={[{ id: "1", name: "Link item", target: "#somewhere" }]}
			>
				<button>Open</button>
			</MenuWidget>,
		);
		fireEvent.click(screen.getByText("Open"));
		expect(screen.getByText("Link item")).toBeInTheDocument();
	});
});
