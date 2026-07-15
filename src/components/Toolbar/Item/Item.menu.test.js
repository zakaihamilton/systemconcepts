import { fireEvent, render, screen } from "@testing-library/react";
import MenuWidget from "@widgets/Menu";
import ToolbarItem from "./Item";

jest.mock("@util/browser/styles", () => ({
	useStyles: () => "item-class",
}));

describe("Toolbar Item menu triggers", () => {
	it("opens submenu when icon button is clicked", () => {
		const items = [{ id: "25", name: "25" }];

		render(
			<MenuWidget items={items}>
				<button type="button">Open Menu</button>
			</MenuWidget>,
		);

		fireEvent.click(screen.getByRole("button", { name: "Open Menu" }));

		expect(screen.getByText("25")).toBeInTheDocument();
	});

	it("opens submenu from toolbar item component", () => {
		render(
			<ToolbarItem
				item={{
					id: "itemsPerPage",
					name: "Rows per page",
					icon: <span data-testid="icon" />,
					items: [{ id: "25", name: "25" }],
				}}
				idx={0}
				count={1}
			/>,
		);

		fireEvent.click(screen.getByRole("button", { name: "Rows per page" }));

		expect(screen.getByText("25")).toBeInTheDocument();
	});

	it("calls onClick for action toolbar items", () => {
		const onClick = jest.fn();

		render(
			<ToolbarItem
				item={{
					id: "sync",
					name: "Sync",
					icon: <span />,
					onClick,
				}}
				idx={0}
				count={1}
			/>,
		);

		fireEvent.click(screen.getByRole("button", { name: "Sync" }));

		expect(onClick).toHaveBeenCalledTimes(1);
	});
});
