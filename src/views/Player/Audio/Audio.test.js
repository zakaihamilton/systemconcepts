import { render } from "@testing-library/react";
import { useDeviceType } from "@util/browser/styles";
import Audio from "./index.js";

jest.mock("../Controls", () => () => <div data-testid="controls" />);
jest.mock("../Toolbar", () => () => <div data-testid="toolbar" />);
jest.mock("../Player", () => ({
	PlayerStore: {
		update: jest.fn(),
	},
}));
jest.mock("@components/Widgets/Group", () => () => <div data-testid="group" />);
jest.mock("@util/data/locale", () => ({
	useDateFormatter: jest
		.fn()
		.mockReturnValue({ format: jest.fn().mockReturnValue("Formatted Date") }),
}));
jest.mock("@util/browser/styles");

describe("Audio Component", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		useDeviceType.mockReturnValue("desktop");
	});

	it("renders audio player container and sub-components", () => {
		const { getByTestId, getByText } = render(
			<Audio
				show={true}
				name="Test Audio"
				group="testgroup"
				color="red"
				date="2021-01-01"
			/>,
		);
		expect(getByText("Test Audio")).toBeInTheDocument();
		expect(getByTestId("group")).toBeInTheDocument();
		expect(getByTestId("controls")).toBeInTheDocument();
		expect(getByTestId("toolbar")).toBeInTheDocument();
	});
});
