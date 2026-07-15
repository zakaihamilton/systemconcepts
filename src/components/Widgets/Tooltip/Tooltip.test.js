import { ToolbarTooltipContext } from "@components/Toolbar/ToolbarContext";
import { render, screen } from "@testing-library/react";
import Tooltip from "./Tooltip";

jest.mock("@ui/Tooltip", () => ({
	__esModule: true,
	default: ({ title, children, placement }) => (
		<div data-placement={placement}>
			{children}
			{title ? <span data-testid="tooltip-title">{title}</span> : null}
		</div>
	),
}));

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

	it("renders tooltip when title is provided", async () => {
		render(
			<Tooltip title="Test Tooltip">
				<span data-testid="child">Hover Me</span>
			</Tooltip>,
		);
		expect(screen.getByTestId("child")).toBeInTheDocument();
		expect(screen.getByTestId("tooltip-title")).toHaveTextContent(
			"Test Tooltip",
		);
	});

	it("uses toolbar context placement when placement is not provided", () => {
		const { container } = render(
			<ToolbarTooltipContext.Provider value="bottom">
				<Tooltip title="Toolbar Tooltip">
					<span>Item</span>
				</Tooltip>
			</ToolbarTooltipContext.Provider>,
		);
		expect(container.querySelector("[data-placement='bottom']")).toBeTruthy();
	});

	it("prefers explicit placement over toolbar context", () => {
		const { container } = render(
			<ToolbarTooltipContext.Provider value="bottom">
				<Tooltip title="Toolbar Tooltip" placement="left">
					<span>Item</span>
				</Tooltip>
			</ToolbarTooltipContext.Provider>,
		);
		expect(container.querySelector("[data-placement='left']")).toBeTruthy();
	});
});
