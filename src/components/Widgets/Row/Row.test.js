import { fireEvent, render } from "@testing-library/react";
import { useDirection } from "@util/data/direction";
import RowWidget from "./index.js";

jest.mock("@util/data/direction");

describe("Row Widget", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		useDirection.mockReturnValue("ltr");
	});

	it("renders children and icons", () => {
		const { getByText, getByTestId } = render(
			<RowWidget icons={<span data-testid="icon" />}>Row Content</RowWidget>,
		);
		expect(getByText("Row Content")).toBeInTheDocument();
		expect(getByTestId("icon")).toBeInTheDocument();
	});

	it("calls onClick when background link is clicked", () => {
		const handleClick = jest.fn();
		const { getByText } = render(
			<RowWidget onClick={handleClick}>Clickable Row</RowWidget>,
		);
		fireEvent.click(getByText("Clickable Row"));
		expect(handleClick).toHaveBeenCalled();
	});

	it("renders a link when href is provided", () => {
		const { getByRole } = render(
			<RowWidget href="#settings/languages">Language</RowWidget>,
		);
		expect(getByRole("link")).toHaveAttribute("href", "#settings/languages");
	});

	it("does not render a link for non-interactive rows", () => {
		const { queryByRole, getByText } = render(
			<RowWidget>Static Row</RowWidget>,
		);
		expect(queryByRole("link")).not.toBeInTheDocument();
		expect(getByText("Static Row")).toBeInTheDocument();
	});
});
