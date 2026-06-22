import { fireEvent, render, screen } from "@testing-library/react";
import Tooltip from "./Tooltip";

describe("Tooltip Widget", () => {
	it("renders children directly if title is not provided", () => {
		const { container } = render(
			<Tooltip>
				<span data-testid="child">Child Content</span>
			</Tooltip>,
		);
		expect(screen.getByTestId("child")).toBeInTheDocument();
		expect(container.textContent).toBe("Child Content");
	});

	it("renders MuiTooltip when title is provided", async () => {
		render(
			<Tooltip title="Test Tooltip">
				<span data-testid="child">Hover Me</span>
			</Tooltip>,
		);
		const child = screen.getByTestId("child");
		expect(child).toBeInTheDocument();

		// Hover to trigger tooltip
		fireEvent.mouseOver(child);

		// The tooltip text should eventually be in the document
		expect(await screen.findByText("Test Tooltip")).toBeInTheDocument();
	});
});
