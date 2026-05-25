import { fireEvent, render } from "@testing-library/react";
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
});
