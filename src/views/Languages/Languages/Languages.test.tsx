import { render } from "@testing-library/react";
import { useTranslations } from "@util/domain/translations";
import Languages from "./index";

jest.mock("@util/domain/translations");
jest.mock("@widgets/Table", () => () => <div data-testid="table" />);
jest.mock("@widgets/Label", () => ({ name }: any) => (
	<div data-testid="label">{name}</div>
));
jest.mock("@widgets/Row", () => ({ children }: any) => (
	<div data-testid="row">{children}</div>
));
jest.mock("@util/domain/views", () => ({
	addPath: jest.fn(),
	toPath: jest.fn(),
}));

describe("Languages View", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		useTranslations.mockReturnValue({
			NAME: "Name",
			DIRECTION: "Direction",
			LEFT_TO_RIGHT: "Left to Right",
			RIGHT_TO_LEFT: "Right to Left",
		});
	});

	it("renders languages table", () => {
		const { getByTestId } = render(<Languages />);
		expect(getByTestId("table")).toBeInTheDocument();
	});
});
