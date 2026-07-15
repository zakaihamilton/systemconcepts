import { render } from "@testing-library/react";
import Loading from "./index.js";

describe("Loading Component", () => {
	it("renders linear progress", () => {
		const { container } = render(<Loading />);
		expect(container.querySelector('[role="progressbar"]')).toBeInTheDocument();
	});

	it("logs error if provided", () => {
		const consoleSpy = jest
			.spyOn(console, "error")
			.mockImplementation(() => {});
		render(<Loading error="Test Error" />);
		expect(consoleSpy).toHaveBeenCalledWith(
			expect.objectContaining({
				level: "error",
				message: "Test Error",
			}),
		);
		consoleSpy.mockRestore();
	});
});
