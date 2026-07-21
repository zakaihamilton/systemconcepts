import { render, screen } from "@testing-library/react";
import Group from "./index.js";

describe("Group Widget", () => {
	it("renders capitalized name", () => {
		const { getByText } = render(<Group name="test" />);
		expect(getByText("Test")).toBeInTheDocument();
	});

	it("applies color to background", () => {
		const { container } = render(<Group name="test" color="red" />);
		const backgrounds = container.querySelectorAll(
			`[style*="background-color: red"]`,
		);
		expect(backgrounds.length).toBeGreaterThan(0);
	});

	it("applies fill, fit, and className modifiers", () => {
		const { container } = render(
			<Group name="alpha" fill fit className="custom" color="#123" />,
		);
		expect(container.querySelector(".custom")).toBeInTheDocument();
		expect(screen.getByText("Alpha")).toBeInTheDocument();
	});

	it("renders without a name", () => {
		const { container } = render(<Group color="blue" />);
		expect(container.querySelector("[dir='auto']")).toBeEmptyDOMElement();
	});
});
