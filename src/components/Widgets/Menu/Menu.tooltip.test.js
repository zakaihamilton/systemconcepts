import { fireEvent, render, screen } from "@testing-library/react";
import Tooltip from "@widgets/Tooltip";
import MenuWidget from "./index.js";

describe("Menu Widget with Tooltip trigger", () => {
	it("opens menu when trigger is wrapped in Tooltip", () => {
		const items = [{ id: "1", name: "Item 1" }];

		render(
			<MenuWidget items={items}>
				<Tooltip title="Menu">
					<button type="button">Open Menu</button>
				</Tooltip>
			</MenuWidget>,
		);

		expect(screen.queryByText("Item 1")).not.toBeInTheDocument();

		fireEvent.click(screen.getByRole("button", { name: "Open Menu" }));

		expect(screen.getByText("Item 1")).toBeInTheDocument();
	});
});
