import { fireEvent, render, screen } from "@testing-library/react";
import Dialog, { DialogActions, DialogContent, DialogTitle } from "./Dialog";

describe("Dialog", () => {
	it("renders nothing when closed", () => {
		const { container } = render(
			<Dialog open={false}>
				<span>hidden</span>
			</Dialog>,
		);
		expect(container).toBeEmptyDOMElement();
	});

	it("portals content and closes on overlay click or Escape", () => {
		const onClose = jest.fn();
		render(
			<Dialog open onClose={onClose} data-testid="overlay">
				<span>body</span>
			</Dialog>,
		);
		expect(screen.getByRole("dialog")).toHaveTextContent("body");
		fireEvent.click(screen.getByTestId("overlay"));
		expect(onClose).toHaveBeenCalled();

		fireEvent.keyDown(document, { key: "Escape" });
		expect(onClose).toHaveBeenCalledTimes(2);

		fireEvent.click(screen.getByRole("dialog"));
		expect(onClose).toHaveBeenCalledTimes(2);
	});

	it("applies fullScreen, fullWidth, named and numeric maxWidth, and minWidth", () => {
		const { rerender } = render(
			<Dialog open fullScreen fullWidth maxWidth="sm" minWidth={200}>
				inner
			</Dialog>,
		);
		expect(screen.getByRole("dialog").style.maxWidth).toBe("600px");
		expect(screen.getByRole("dialog").style.width).toBe("100%");
		expect(screen.getByRole("dialog").style.minWidth).toBe("200px");

		rerender(
			<Dialog open maxWidth={320}>
				inner
			</Dialog>,
		);
		expect(screen.getByRole("dialog").style.maxWidth).toBe("320px");

		["xs", "md", "lg", "xl"].forEach((size) => {
			rerender(
				<Dialog open maxWidth={size}>
					inner
				</Dialog>,
			);
			expect(screen.getByRole("dialog").style.maxWidth).toBeTruthy();
		});
	});

	it("renders title, content with dividers, and actions", () => {
		render(
			<>
				<DialogTitle className="t" style={{ color: "red" }}>
					Title
				</DialogTitle>
				<DialogContent dividers className="c">
					Content
				</DialogContent>
				<DialogActions className="a">Actions</DialogActions>
			</>,
		);
		expect(screen.getByText("Title")).toHaveClass("t");
		expect(screen.getByText("Content")).toHaveClass("c");
		expect(screen.getByText("Actions")).toHaveClass("a");
	});

	it("does not register escape handler when closed", () => {
		const onClose = jest.fn();
		render(
			<Dialog open={false} onClose={onClose}>
				x
			</Dialog>,
		);
		fireEvent.keyDown(document, { key: "Escape" });
		expect(onClose).not.toHaveBeenCalled();
	});

	it("ignores Escape when no onClose handler is provided", () => {
		render(
			<Dialog open>
				<span>body</span>
			</Dialog>,
		);
		expect(() => {
			fireEvent.keyDown(document, { key: "Escape" });
		}).not.toThrow();
	});
});
