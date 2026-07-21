import { render, screen } from "@testing-library/react";
import { createRef } from "react";
import { createIcon, withIcon } from "./Icon";

describe("Icon helpers", () => {
	it("withIcon resolves size, fontSize, color tokens, and aria-label", () => {
		const Svg = ({ "aria-hidden": ariaHidden, ...props }) => (
			<svg data-testid="svg" aria-hidden={ariaHidden} {...props} />
		);
		const Icon = withIcon(Svg, "TestIcon");
		const ref = createRef();
		const { rerender } = render(
			<Icon ref={ref} size={16} color="primary" className="c" />,
		);
		expect(screen.getByTestId("svg")).toHaveAttribute("width", "16");
		expect(screen.getByTestId("svg")).toHaveAttribute("aria-hidden", "true");
		expect(ref.current).toBeTruthy();

		rerender(<Icon fontSize="small" color="error" />);
		expect(screen.getByTestId("svg")).toHaveAttribute("width", "20");

		rerender(<Icon fontSize="large" color="secondary" />);
		expect(screen.getByTestId("svg")).toHaveAttribute("width", "35");

		rerender(
			<Icon fontSize="inherit" color="custom" style={{ opacity: 0.5 }} />,
		);
		expect(screen.getByTestId("svg")).toHaveAttribute("width", "1em");

		rerender(<Icon fontSize="medium" color="warning" aria-label="labeled" />);
		expect(screen.getByTestId("svg")).not.toHaveAttribute("aria-hidden");

		rerender(<Icon color="action" />);
		rerender(<Icon color="inherit" />);
	});

	it("createIcon renders children and supports the same prop resolution", () => {
		const Icon = createIcon(<path d="M0 0h24v24H0z" />, "PathIcon");
		render(<Icon data-testid="created" color="primary" />);
		expect(screen.getByTestId("created").tagName.toLowerCase()).toBe("svg");
		expect(screen.getByTestId("created").querySelector("path")).toBeTruthy();
	});
});
