import { act, fireEvent, render, screen } from "@testing-library/react";
import Tooltip from "./Tooltip";

describe("Tooltip", () => {
	beforeEach(() => {
		jest.useFakeTimers();
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	it("forwards onClick to the anchor element", () => {
		const handleClick = jest.fn();

		render(
			<Tooltip title="Rows per page" onClick={handleClick}>
				<button type="button">Open</button>
			</Tooltip>,
		);

		fireEvent.click(screen.getByRole("button", { name: "Open" }));

		expect(handleClick).toHaveBeenCalledTimes(1);
	});

	it("shows after a one-second touch hold and hides when the touch ends", () => {
		render(
			<Tooltip title="Touch tooltip">
				<button type="button">Hold</button>
			</Tooltip>,
		);

		const trigger = screen.getByRole("button", { name: "Hold" });
		fireEvent.touchStart(trigger);
		expect(screen.queryByText("Touch tooltip")).not.toBeInTheDocument();

		act(() => jest.advanceTimersByTime(1000));
		expect(screen.getByText("Touch tooltip")).toBeInTheDocument();

		fireEvent.touchEnd(trigger);
		expect(screen.queryByText("Touch tooltip")).not.toBeInTheDocument();
	});

	it("does not show after a short touch tap", () => {
		render(
			<Tooltip title="Touch tooltip">
				<button type="button">Tap</button>
			</Tooltip>,
		);

		const trigger = screen.getByRole("button", { name: "Tap" });
		fireEvent.touchStart(trigger);
		fireEvent.touchEnd(trigger);
		fireEvent.focus(trigger);
		fireEvent.mouseEnter(trigger);

		expect(screen.queryByText("Touch tooltip")).not.toBeInTheDocument();
	});

	it("returns children unchanged when title is empty", () => {
		render(
			<Tooltip title="">
				<button type="button">Bare</button>
			</Tooltip>,
		);
		expect(screen.getByRole("button", { name: "Bare" })).toBeInTheDocument();
	});

	it("shows on hover/focus with enterDelay and hides with leaveDelay", () => {
		const onEnter = jest.fn();
		const onLeave = jest.fn();
		const onFocus = jest.fn();
		const onBlur = jest.fn();
		render(
			<Tooltip
				title="Delayed"
				enterDelay={200}
				leaveDelay={100}
				onMouseEnter={onEnter}
				onMouseLeave={onLeave}
				onFocus={onFocus}
				onBlur={onBlur}
				disableInteractive
				placement="bottom"
			>
				<button type="button">Hover</button>
			</Tooltip>,
		);
		const trigger = screen.getByRole("button", { name: "Hover" });
		fireEvent.mouseEnter(trigger);
		expect(onEnter).toHaveBeenCalled();
		expect(screen.queryByText("Delayed")).not.toBeInTheDocument();
		act(() => jest.advanceTimersByTime(200));
		expect(screen.getByText("Delayed")).toBeInTheDocument();

		fireEvent.mouseLeave(trigger);
		expect(onLeave).toHaveBeenCalled();
		act(() => jest.advanceTimersByTime(100));
		expect(screen.queryByText("Delayed")).not.toBeInTheDocument();

		fireEvent.focus(trigger);
		expect(onFocus).toHaveBeenCalled();
		act(() => jest.advanceTimersByTime(200));
		expect(screen.getByText("Delayed")).toBeInTheDocument();
		fireEvent.blur(trigger);
		expect(onBlur).toHaveBeenCalled();
	});

	it("respects disableHoverListener and touch cancel/move", () => {
		const onTouchStart = jest.fn();
		const onTouchCancel = jest.fn();
		const onTouchMove = jest.fn();
		render(
			<Tooltip
				title="No hover"
				disableHoverListener
				onTouchStart={onTouchStart}
				onTouchCancel={onTouchCancel}
				onTouchMove={onTouchMove}
			>
				<button type="button">T</button>
			</Tooltip>,
		);
		const trigger = screen.getByRole("button", { name: "T" });
		fireEvent.mouseEnter(trigger);
		expect(screen.queryByText("No hover")).not.toBeInTheDocument();

		fireEvent.touchStart(trigger);
		expect(onTouchStart).toHaveBeenCalled();
		act(() => jest.advanceTimersByTime(1000));
		expect(screen.getByText("No hover")).toBeInTheDocument();
		fireEvent.touchCancel(trigger);
		expect(onTouchCancel).toHaveBeenCalled();

		fireEvent.touchStart(trigger);
		act(() => jest.advanceTimersByTime(1000));
		fireEvent.touchMove(trigger);
		expect(onTouchMove).toHaveBeenCalled();
	});

	it("repositions on resize and scroll while open", () => {
		render(
			<Tooltip title="Pos">
				<button type="button">P</button>
			</Tooltip>,
		);
		const trigger = screen.getByRole("button", { name: "P" });
		fireEvent.mouseEnter(trigger);
		expect(screen.getByText("Pos")).toBeInTheDocument();
		act(() => {
			fireEvent(window, new Event("resize"));
			fireEvent(window, new Event("scroll"));
		});
		expect(screen.getByText("Pos")).toBeInTheDocument();
	});

	it("forwards non-event props to the tooltip portal", () => {
		render(
			<Tooltip title="Meta" data-testid="tooltip-portal">
				<button type="button">Meta</button>
			</Tooltip>,
		);
		fireEvent.mouseEnter(screen.getByRole("button", { name: "Meta" }));
		expect(screen.getByTestId("tooltip-portal")).toBeInTheDocument();
	});
});
