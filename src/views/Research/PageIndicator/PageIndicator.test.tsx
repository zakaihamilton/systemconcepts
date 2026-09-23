import { fireEvent, render, screen } from "@testing-library/react";
import PageIndicator from "./PageIndicator";

describe("Research PageIndicator", () => {
	it("renders as a clickable button that opens the results outline", () => {
		const onClick = jest.fn();
		render(
			<PageIndicator
				current={1}
				total={13}
				visible
				label="Article"
				translations={{ PAGE: "Page" }}
				onClick={onClick}
			/>,
		);

		const button = screen.getByRole("button", { name: "Article 1 / 13" });
		expect(button).toHaveAttribute("aria-haspopup", "menu");
		fireEvent.click(button);
		expect(onClick).toHaveBeenCalledTimes(1);
	});

	it("renders plain text when not clickable", () => {
		render(
			<PageIndicator
				current={2}
				total={5}
				visible
				label="Article"
				translations={{ PAGE: "Page" }}
			/>,
		);

		expect(screen.queryByRole("button")).not.toBeInTheDocument();
		expect(screen.getByText("Article 2 / 5")).toBeInTheDocument();
	});
});
