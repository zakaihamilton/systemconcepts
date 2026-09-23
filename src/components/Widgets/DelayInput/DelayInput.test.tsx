import { act, fireEvent, render } from "@testing-library/react";
import { useTimeout } from "@util/browser/timers";
import DelayInput from "./index";

jest.mock("@util/browser/timers");

describe("DelayInput Widget", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("updates current value immediately but calls onChange after delay", () => {
		const handleChange = jest.fn();
		let timeoutCallback: any;
		asMock(useTimeout).mockImplementation((callback: any) => {
			timeoutCallback = callback;
		});

		const { getByRole } = render(
			<DelayInput onChange={handleChange}>
				<input role="textbox" />
			</DelayInput>,
		);

		const input = getByRole("textbox") as HTMLInputElement;
		fireEvent.change(input, { target: { value: "test" } });

		expect(input.value).toBe("test");
		expect(handleChange).not.toHaveBeenCalled();

		// Trigger the timeout callback manually
		act(() => {
			timeoutCallback();
		});

		expect(handleChange).toHaveBeenCalledWith({ target: { value: "test" } });
	});
});
