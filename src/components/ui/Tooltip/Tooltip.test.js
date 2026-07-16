import { act, fireEvent, render, screen } from "@testing-library/react";
import Tooltip from "./Tooltip";

describe("Tooltip", () => {
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
		jest.useFakeTimers();

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

		jest.useRealTimers();
	});

	it("does not show after a short touch tap", () => {
		jest.useFakeTimers();

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

		jest.useRealTimers();
	});
});
