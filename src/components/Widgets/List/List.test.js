import { fireEvent, render } from "@testing-library/react";
import ListWidget from "./index.js";

jest.mock("@components/Main", () => ({
	MainStore: {
		useState: jest.fn().mockReturnValue({ direction: "ltr" }),
	},
}));

describe("List Widget", () => {
	const items = [
		{ id: "1", name: "Item 1", description: "Desc 1" },
		{ id: "2", name: "Item 2", items: [{ id: "2.1", name: "Sub Item 1" }] },
	];

	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("renders list items", () => {
		const { getByText } = render(<ListWidget items={items} />);
		expect(getByText("Item 1")).toBeInTheDocument();
		expect(getByText("Desc 1")).toBeInTheDocument();
		expect(getByText("Item 2")).toBeInTheDocument();
	});

	it("calls onClick when item is clicked", () => {
		const handleClick = jest.fn();
		const { getByText } = render(
			<ListWidget items={items} onClick={handleClick} />,
		);
		fireEvent.click(getByText("Item 1"));
		expect(handleClick).toHaveBeenCalledWith("1");
	});

	it("toggles nested list items", () => {
		const { getByText, queryByText } = render(<ListWidget items={items} />);
		expect(queryByText("Sub Item 1")).not.toBeInTheDocument();

		fireEvent.click(getByText("Item 2"));
		expect(getByText("Sub Item 1")).toBeInTheDocument();
	});
});
