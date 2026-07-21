import { act, render, screen } from "@testing-library/react";
import Snackbar from "./Snackbar";

describe("Snackbar", () => {
	beforeEach(() => {
		jest.useFakeTimers();
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	it("renders nothing when closed", () => {
		const { container } = render(<Snackbar open={false} message="hi" />);
		expect(container).toBeEmptyDOMElement();
		expect(screen.queryByRole("status")).not.toBeInTheDocument();
	});

	it("portals the message when open", () => {
		render(<Snackbar open message="Saved" />);
		expect(screen.getByRole("status")).toHaveTextContent("Saved");
	});

	it("auto-hides via onClose after the duration", () => {
		const onClose = jest.fn();
		render(
			<Snackbar open message="bye" onClose={onClose} autoHideDuration={1000} />,
		);
		expect(onClose).not.toHaveBeenCalled();
		act(() => {
			jest.advanceTimersByTime(1000);
		});
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it("does not schedule hide when autoHideDuration is falsy", () => {
		const onClose = jest.fn();
		render(
			<Snackbar open message="stay" onClose={onClose} autoHideDuration={0} />,
		);
		act(() => {
			jest.advanceTimersByTime(5000);
		});
		expect(onClose).not.toHaveBeenCalled();
	});

	it("does not schedule hide when onClose is missing", () => {
		render(<Snackbar open message="stay" autoHideDuration={500} />);
		act(() => {
			jest.advanceTimersByTime(500);
		});
		expect(screen.getByRole("status")).toHaveTextContent("stay");
	});
});
