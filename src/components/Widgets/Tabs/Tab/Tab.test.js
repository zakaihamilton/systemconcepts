import { render } from "@testing-library/react";
import Tabs from "@ui/Tabs";
import { useDeviceType } from "@util/browser/styles";
import TabWidget from "./Tab.js";

jest.mock("@util/browser/styles");

describe("TabWidget Component", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("renders content with desktop styling when not on phone", () => {
		useDeviceType.mockReturnValue("desktop");

		const { getByText } = render(
			<Tabs value="tab">
				<TabWidget
					icon={<span data-testid="icon" />}
					label="My Tab"
					value="tab"
				/>
			</Tabs>,
		);

		const labelEl = getByText("My Tab");
		expect(labelEl).toBeInTheDocument();
		expect(labelEl).not.toHaveClass("mobile");
	});

	it("renders content with mobile styling when on phone", () => {
		useDeviceType.mockReturnValue("phone");

		const { getByText } = render(
			<Tabs value="tab">
				<TabWidget
					icon={<span data-testid="icon" />}
					label="My Tab"
					value="tab"
				/>
			</Tabs>,
		);

		const labelEl = getByText("My Tab");
		expect(labelEl).toBeInTheDocument();
		expect(labelEl).toHaveClass("mobile");
	});
});
