import { fireEvent, render } from "@testing-library/react";
import { setPath, usePages } from "@util/views";
import Apps from "./index.js";

jest.mock("@util/views");

describe("Apps View", () => {
	const mockPages = [
		{
			id: "app1",
			name: "App 1",
			apps: true,
			Icon: () => <div data-testid="icon1" />,
		},
		{
			id: "app2",
			name: "App 2",
			apps: true,
			Icon: () => <div data-testid="icon2" />,
		},
		{ id: "page1", name: "Page 1", apps: false },
	];

	beforeEach(() => {
		jest.clearAllMocks();
		usePages.mockReturnValue(mockPages);
	});

	it("renders app items", () => {
		const { getByText, getByTestId } = render(<Apps />);
		expect(getByText("App 1")).toBeInTheDocument();
		expect(getByText("App 2")).toBeInTheDocument();
		expect(getByTestId("icon1")).toBeInTheDocument();
		expect(getByTestId("icon2")).toBeInTheDocument();
	});

	it("filters and sorts apps correctly", () => {
		const { getAllByRole } = render(<Apps />);
		const links = getAllByRole("link");
		expect(links).toHaveLength(2);
		// Sort is b.name.localeCompare(a.name), so App 2 should be first
		expect(links[0]).toHaveTextContent("App 2");
		expect(links[1]).toHaveTextContent("App 1");
	});

	it("calls setPath when an app is clicked", () => {
		const { getByText } = render(<Apps />);
		fireEvent.click(getByText("App 1"));
		expect(setPath).toHaveBeenCalledWith("app1");
	});
});
