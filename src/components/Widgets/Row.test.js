import { fireEvent, render } from "@testing-library/react";
import { useDirection } from "@util/direction";
import RowWidget from "./Row";

jest.mock("@util/direction");

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
});
