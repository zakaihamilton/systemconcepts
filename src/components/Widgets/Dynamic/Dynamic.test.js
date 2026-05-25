import { render } from "@testing-library/react";
import { useDeviceType } from "@util/browser/styles";
import DynamicWidget from "./index.js";

jest.mock("@util/browser/styles");
jest.mock("../ToggleButtonGroup", () => () => (
	<div data-testid="toggle-button-group" />
));
jest.mock("../Input", () => () => <div data-testid="input-select" />);

describe("Dynamic Widget", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("renders ToggleButtonGroup for few items on desktop", () => {
		useDeviceType.mockReturnValue("desktop");
		const { getByTestId } = render(<DynamicWidget items={Array(5).fill({})} />);
		expect(getByTestId("toggle-button-group")).toBeInTheDocument();
	});

	it("renders Input for many items on desktop", () => {
		useDeviceType.mockReturnValue("desktop");
		const { getByTestId } = render(
			<DynamicWidget items={Array(10).fill({})} />,
		);
		expect(getByTestId("input-select")).toBeInTheDocument();
	});

	it("renders Input for few items on phone", () => {
		useDeviceType.mockReturnValue("phone");
		const { getByTestId } = render(<DynamicWidget items={Array(5).fill({})} />);
		expect(getByTestId("input-select")).toBeInTheDocument();
	});
});
