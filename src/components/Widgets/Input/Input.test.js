import { fireEvent, render } from "@testing-library/react";
import { useTranslations } from "@util/domain/translations";
import InputWidget from "./index.js";

jest.mock("@util/domain/translations");

describe("Input Widget", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		useTranslations.mockReturnValue({
			SHOW_PASSWORD: "Show",
			HIDE_PASSWORD: "Hide",
		});
	});

	it("renders with label and initial value", () => {
		const setValue = jest.fn();
		const { getByLabelText } = render(
			<InputWidget label="Username" state={["testuser", setValue]} />,
		);
		const input = getByLabelText("Username");
		expect(input.value).toBe("testuser");
	});

	it("calls setValue and onValidate when text changes", () => {
		const setValue = jest.fn();
		const onValidate = jest.fn().mockReturnValue("Invalid");
		const { getByLabelText, getByText } = render(
			<InputWidget
				label="Username"
				state={["", setValue]}
				validate={true}
				onValidate={onValidate}
			/>,
		);
		const input = getByLabelText("Username");
		fireEvent.change(input, { target: { value: "newuser" } });

		expect(setValue).toHaveBeenCalledWith("newuser");
		expect(onValidate).toHaveBeenCalledWith("newuser");
		expect(getByText("Invalid")).toBeInTheDocument();
	});

	it("toggles password visibility", () => {
		const setValue = jest.fn();
		const { getByLabelText } = render(
			<InputWidget
				label="Password"
				type="password"
				state={["pass", setValue]}
			/>,
		);
		const input = getByLabelText("Password");
		expect(input.getAttribute("type")).toBe("password");

		const showButton = getByLabelText("Show");
		fireEvent.click(showButton);
		expect(input.getAttribute("type")).toBe("text");
	});
});
