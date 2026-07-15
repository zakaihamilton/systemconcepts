import { fireEvent, render } from "@testing-library/react";
import Slider from "./Slider";

describe("Slider", () => {
	it("maps a discrete marked range back to the selected mark value", () => {
		const onChange = jest.fn();
		const { getByLabelText } = render(
			<Slider
				aria-label="Speed"
				value={1}
				min={0.5}
				max={2}
				step={null}
				marks={[
					{ value: 0.5, label: "0.5x" },
					{ value: 1, label: "1x" },
					{ value: 1.1, label: "" },
					{ value: 2, label: "2x" },
				]}
				onChange={onChange}
			/>,
		);

		const slider = getByLabelText("Speed");
		expect(slider).toHaveAttribute("min", "0.5");
		expect(slider).toHaveAttribute("max", "2");
		expect(slider).toHaveAttribute("step", "0.1");
		expect(slider).toHaveValue("1");
		expect(slider).toHaveStyle({ "--slider-progress": "33.33333333333333%" });
		fireEvent.change(slider, { target: { value: "1.1" } });
		expect(onChange).toHaveBeenCalledWith(expect.anything(), 1.1);
	});
});
