import { render } from "@testing-library/react";
import Progress from "./index.js";

describe("Progress Widget", () => {
	it("renders circular progress", () => {
		const { container } = render(<Progress />);
		expect(container.querySelector('[role="progressbar"]')).toBeInTheDocument();
	});

	it("renders percentage when value is provided", () => {
		const { getByText } = render(<Progress value={50} />);
		expect(getByText("50%")).toBeInTheDocument();
	});

	it("applies fullscreen class when fullscreen is true", () => {
		const { container } = render(<Progress fullscreen={true} />);
		// Check for the presence of the root div with the correct class if possible
		expect(container.firstChild).toHaveClass("root");
		expect(container.firstChild).toHaveClass("fullscreen");
	});
});
