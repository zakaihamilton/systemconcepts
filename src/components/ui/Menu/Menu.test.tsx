import { act, fireEvent, render, screen } from "@testing-library/react";
import Menu from "./Menu";

function makeAnchor(rect = {}) {
	const anchor = document.createElement("button");
	anchor.getBoundingClientRect = () => ({
		bottom: 48,
		height: 32,
		left: 24,
		right: 56,
		top: 16,
		width: 32,
		...rect,
	});
	document.body.appendChild(anchor);
	return anchor;
}

describe("Menu", () => {
	beforeEach(() => {
		jest.useFakeTimers();
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	it("keeps its anchor position when a caller adds menu styles", () => {
		const anchor = makeAnchor();
		render(
			<Menu
				open
				anchorEl={anchor}
				onClose={jest.fn()}
				style={{ minWidth: 120 }}
			>
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

	it("returns null when closed or missing an anchor", () => {
		const { container, rerender } = render(
			<Menu open={false} anchorEl={document.createElement("div")}>
				x
			</Menu>,
		);
		expect(container).toBeEmptyDOMElement();
		rerender(
			<Menu open anchorEl={null}>
				x
			</Menu>,
		);
		expect(screen.queryByRole("menu")).not.toBeInTheDocument();
	});

	it("positions with right/center/top origins and flips when overflowing", () => {
		const anchor = makeAnchor({
			top: window.innerHeight - 10,
			bottom: window.innerHeight,
			left: window.innerWidth - 10,
			right: window.innerWidth,
			width: 10,
			height: 10,
		});
		render(
			<Menu
				open
				anchorEl={anchor}
				anchorOrigin={{ vertical: "top", horizontal: "right" }}
				transformOrigin={{ vertical: "bottom", horizontal: "right" }}
			>
				<div style={{ width: 200, height: 200 }}>big</div>
			</Menu>,
		);
		expect(screen.getByRole("menu")).toBeInTheDocument();

		act(() => {
			fireEvent(window, new Event("resize"));
			fireEvent(window, new Event("scroll"));
		});
		anchor.remove();
	});

	it("centers horizontally and closes on outside click and Escape", () => {
		const onClose = jest.fn();
		const anchor = makeAnchor();
		render(
			<>
				<div data-testid="outside">out</div>
				<Menu
					open
					anchorEl={anchor}
					onClose={onClose}
					anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
					className="custom-menu"
				>
					<button type="button">inside</button>
				</Menu>
			</>,
		);

		expect(screen.getByRole("menu")).toHaveClass("custom-menu");
		act(() => {
			jest.runAllTimers();
		});
		fireEvent.click(screen.getByTestId("outside"));
		expect(onClose).toHaveBeenCalled();
		fireEvent.keyDown(document, { key: "Escape" });
		expect(onClose).toHaveBeenCalledTimes(2);
		fireEvent.click(screen.getByText("inside"));
		anchor.remove();
	});

	it("repositions when the menu would overflow the viewport bottom", () => {
		const anchor = makeAnchor({
			top: window.innerHeight - 20,
			bottom: window.innerHeight,
			left: 40,
			right: 80,
			width: 40,
			height: 20,
		});
		render(
			<Menu
				open
				anchorEl={anchor}
				anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
			>
				<div style={{ width: 120, height: 240 }}>tall menu</div>
			</Menu>,
		);
		const menu = screen.getByRole("menu");
		expect(menu).toBeInTheDocument();
		expect(menu.style.top).not.toBe("");
		anchor.remove();
	});

	it("skips repositioning when closed or anchor is missing", () => {
		const anchor = makeAnchor();
		const { rerender } = render(
			<Menu open={false} anchorEl={anchor}>
				x
			</Menu>,
		);
		expect(screen.queryByRole("menu")).not.toBeInTheDocument();
		rerender(
			<Menu open anchorEl={null}>
				x
			</Menu>,
		);
		expect(screen.queryByRole("menu")).not.toBeInTheDocument();
		anchor.remove();
	});
});
