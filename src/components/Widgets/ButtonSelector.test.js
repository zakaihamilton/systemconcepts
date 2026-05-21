import { fireEvent, render } from "@testing-library/react";
import { useTranslations } from "@util/translations";
import ButtonSelector from "./ButtonSelector";

jest.mock("@util/translations");

describe("ButtonSelector Widget", () => {
	const items = [
		{ id: "1", name: "Option 1" },
		{ id: "2", name: "Option 2" },
	];

	beforeEach(() => {
		jest.clearAllMocks();
		useTranslations.mockReturnValue({ OPTIONS: "Options" });
	});

	it("renders button and dropdown", () => {
		const setSelected = jest.fn();
		const { getByText, getByLabelText } = render(
			<ButtonSelector state={["1", setSelected]} items={items}>
				Main Button
			</ButtonSelector>,
		);
		expect(getByText("Main Button")).toBeInTheDocument();
		expect(getByLabelText("Options")).toBeInTheDocument();
	});

	it("calls onClick when main button is clicked", () => {
		const handleClick = jest.fn();
		const setSelected = jest.fn();
		const { getByText } = render(
			<ButtonSelector
				state={["1", setSelected]}
				items={items}
				onClick={handleClick}
			>
				Main Button
			</ButtonSelector>,
		);
		fireEvent.click(getByText("Main Button"));
		expect(handleClick).toHaveBeenCalled();
	});

	it("opens menu and selects item", () => {
		const setSelected = jest.fn();
		const { getByLabelText, getByText } = render(
			<ButtonSelector state={["1", setSelected]} items={items}>
				Main Button
			</ButtonSelector>,
		);
		fireEvent.click(getByLabelText("Options"));
		fireEvent.click(getByText("Option 2"));
		expect(setSelected).toHaveBeenCalledWith("2");
	});
});
