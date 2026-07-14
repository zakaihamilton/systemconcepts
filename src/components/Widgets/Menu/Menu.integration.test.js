import { fireEvent, render, screen } from "@testing-library/react";
import Tooltip from "@widgets/Tooltip";
import MenuWidget from "./Menu";

describe("Menu integration", () => {
	it("calls item onClick in controlled mode", () => {
		const onClick = jest.fn();
		const items = [{ id: "sync", name: "Sync", onClick }];
		const anchor = document.createElement("button");
		document.body.appendChild(anchor);

		render(
			<MenuWidget
				items={items}
				open={true}
				anchorEl={anchor}
				onClose={jest.fn()}
			/>,
		);

		fireEvent.click(screen.getByRole("menuitem", { name: "Sync" }));

		expect(onClick).toHaveBeenCalledTimes(1);
	});

	it("opens and selects item with Tooltip trigger", () => {
		const onClick = jest.fn();
		const items = [{ id: "action", name: "Action", onClick }];

		render(
			<MenuWidget items={items}>
				<Tooltip title="Menu">
					<button type="button">Open</button>
				</Tooltip>
			</MenuWidget>,
		);

		fireEvent.click(screen.getByRole("button", { name: "Open" }));
		fireEvent.click(screen.getByRole("menuitem", { name: "Action" }));

		expect(onClick).toHaveBeenCalledTimes(1);
	});
});
