import { MainStore } from "@components/Main";
import { fireEvent, render } from "@testing-library/react";
import { useTranslations } from "@util/translations";
import { goBackPage } from "@util/views";
import Reset from "./index.js";

jest.mock("@util/translations");
jest.mock("@components/Main", () => ({
	MainStore: {
		update: jest.fn(),
	},
	MainStoreDefaults: {},
}));
jest.mock("@util/views");
jest.mock("@widgets/Dialog", () => ({ title, children, actions }) => (
	<div data-testid="dialog">
		<h1>{title}</h1>
		{children}
		<div data-testid="actions">{actions}</div>
	</div>
));

describe("Reset Component", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		useTranslations.mockReturnValue({
			RESET: "Reset",
			CANCEL: "Cancel",
			RESET_SETTINGS: "Reset Settings",
			RESET_MESSAGE: "Reset everything?",
		});
	});

	it("renders dialog with reset message", () => {
		const { getByText } = render(<Reset />);
		expect(getByText("Reset everything?")).toBeInTheDocument();
	});

	it("calls MainStore.update and goBackPage when reset is clicked", () => {
		const { getByText } = render(<Reset />);
		fireEvent.click(getByText("Reset"));
		expect(MainStore.update).toHaveBeenCalled();
		expect(goBackPage).toHaveBeenCalled();
	});
});
