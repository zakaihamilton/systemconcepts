import { render, screen } from "@testing-library/react";
import Menu from "./Menu";

describe("Menu", () => {
	it("keeps its anchor position when a caller adds menu styles", () => {
		const anchor = document.createElement("button");
		anchor.getBoundingClientRect = () => ({
			bottom: 48,
			height: 32,
			left: 24,
			right: 56,
			top: 16,
			width: 32,
		});
		document.body.appendChild(anchor);

		render(
			<Menu open anchorEl={anchor} onClose={jest.fn()} style={{ minWidth: 120 }}>
				<div>Menu content</div>
			</Menu>,
		);

		const menu = screen.getByRole("menu");
		expect(menu).toHaveStyle({
			left: "24px",
			minWidth: "120px",
			position: "fixed",
			top: "56px",
			zIndex: "1300",
		});

		anchor.remove();
	});
});
