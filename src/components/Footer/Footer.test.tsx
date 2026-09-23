import { render } from "@testing-library/react";
import { useDeviceType } from "@util/browser/styles";
import { useToolbarItems } from "../Toolbar/index";
import Footer from "./index";

jest.mock("@util/browser/styles");
jest.mock("../Toolbar", () => {
	const ActualToolbar = ({ location }: any) => (
		<div data-testid={`toolbar-${location}`} />
	);
	return {
		__esModule: true,
		default: ActualToolbar,
		useToolbarItems: jest.fn(),
	};
});

describe("Footer Component", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("renders nothing if no items are present", () => {
		asMock(useToolbarItems).mockReturnValue([]);
		const { container } = render(<Footer />);
		expect(container.firstChild).toBeNull();
	});

	it("renders footer toolbar if footer items are present", () => {
		asMock(useToolbarItems).mockImplementation(({ location }: any) =>
			location === "footer" ? [{ id: "test" }] : [],
		);
		const { getByTestId } = render(<Footer />);
		expect(getByTestId("toolbar-footer")).toBeInTheDocument();
	});

	it("renders mobile toolbar if on phone and mobile items are present", () => {
		asMock(useDeviceType).mockReturnValue("phone");
		asMock(useToolbarItems).mockImplementation(({ location }: any) =>
			location === "mobile" ? [{ id: "test" }] : [],
		);
		const { getByTestId } = render(<Footer />);
		expect(getByTestId("toolbar-mobile")).toBeInTheDocument();
	});
});
