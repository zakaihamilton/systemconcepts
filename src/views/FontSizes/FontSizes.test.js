import { render } from "@testing-library/react";
import { useTranslations } from "@util/translations";
import FontSizes from "./FontSizes";

jest.mock("@util/translations");
jest.mock("@widgets/Table", () => () => <div data-testid="table" />);
jest.mock("@widgets/Label", () => ({ name }) => (
	<div data-testid="label">{name}</div>
));

describe("FontSizes View", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		useTranslations.mockReturnValue({
			NAME: "Name",
			FONT_SIZE: "Font Size",
			DEVICES: "Devices",
			MOBILE: "Mobile",
			TABLET: "Tablet",
			DESKTOP: "Desktop",
		});
	});

	it("renders font sizes table", () => {
		const { getByTestId } = render(<FontSizes />);
		expect(getByTestId("table")).toBeInTheDocument();
	});
});
