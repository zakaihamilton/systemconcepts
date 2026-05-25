import { act, fireEvent, render } from "@testing-library/react";
import { useTimeout } from "@util/browser/timers";
import DelayInput from "./index.js";

jest.mock("@util/browser/timers");

describe("DelayInput Widget", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("updates current value immediately but calls onChange after delay", () => {
		const handleChange = jest.fn();
		let timeoutCallback;
		useTimeout.mockImplementation((callback) => {
			timeoutCallback = callback;
		});

		const { getByRole } = render(
			<DelayInput onChange={handleChange}>
				<input role="textbox" />
			</DelayInput>,
		);

		const input = getByRole("textbox");
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
