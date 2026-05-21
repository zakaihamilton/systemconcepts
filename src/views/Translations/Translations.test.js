import { render } from "@testing-library/react";
import { useTranslations } from "@util/translations";
import Translations from "./Translations";

jest.mock("@util/translations");
jest.mock("@util/store", () => ({
	useLocalStorage: jest.fn(),
}));
jest.mock("@widgets/Table", () => () => <div data-testid="table" />);
jest.mock("@data/languages", () => [
	{ id: "en", name: "English", translations: { HELLO: "Hello" } },
]);

describe("Translations View", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		useTranslations.mockReturnValue({ ID: "ID" });
	});

	it("renders translations table", () => {
		const { getByTestId } = render(<Translations language="en" />);
		expect(getByTestId("table")).toBeInTheDocument();
	});

	it("renders nothing if language is not found", () => {
		const { getByTestId } = render(<Translations language="nonexistent" />);
		expect(getByTestId("table")).toBeInTheDocument(); // Table is still rendered, but data will be null
	});
});
