import { fireEvent, render, screen } from "@testing-library/react";
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
		fireEvent.change(slider, { target: { value: "1.1" } });
		expect(onChange).toHaveBeenCalledWith(expect.anything(), 1.1);
	});

	it("dedupes discrete marks and handles equal min/max", () => {
		const onChange = jest.fn();
		render(
			<Slider
				aria-label="Flat"
				value={5}
				min={0}
				max={10}
				step={null}
				marks={[
					{ value: 5, label: "five" },
					{ value: 5, label: "dup" },
					{ value: 3, label: "three" },
				]}
				onChange={onChange}
			/>,
		);
		const slider = screen.getByLabelText("Flat");
		fireEvent.change(slider, { target: { value: "3" } });
		expect(onChange).toHaveBeenCalledWith(expect.anything(), 3);

		const { getByLabelText } = render(
			<Slider
				aria-label="Same"
				value={5}
				min={5}
				max={5}
				step={null}
				marks={[{ value: 5, label: "only" }]}
			/>,
		);
		expect(
			getByLabelText("Same").style.getPropertyValue("--slider-progress"),
		).toBe("0%");
	});

	it("uses continuous step mode and datalist marks", () => {
		const onChange = jest.fn();
		render(
			<Slider
				aria-label="Continuous"
				value={25}
				min={0}
				max={100}
				step={5}
				marks={[
					{ value: 0, label: "low" },
					{ value: 100, label: "high" },
				]}
				onChange={onChange}
			/>,
		);
		const slider = screen.getByLabelText("Continuous");
		expect(slider).toHaveAttribute("list", "slider-marks");
		fireEvent.change(slider, { target: { value: "30" } });
		expect(onChange).toHaveBeenCalledWith(expect.anything(), 30);
	});

	it("shows an auto value label while dragging", () => {
		render(
			<Slider
				aria-label="Labeled"
				value={40}
				min={0}
				max={100}
				valueLabelDisplay="auto"
				valueLabelFormat={(v) => `${v}%`}
			/>,
		);
		const slider = screen.getByLabelText("Labeled");
		expect(slider).toHaveAttribute("aria-valuetext", "40%");
		fireEvent.mouseDown(slider);
		expect(screen.getByText("40%")).toBeInTheDocument();
		fireEvent.mouseUp(slider);
		expect(screen.queryByText("40%")).not.toBeInTheDocument();
	});

	it("works without onChange and without marks", () => {
		render(<Slider aria-label="Bare" value={10} />);
		fireEvent.change(screen.getByLabelText("Bare"), {
			target: { value: "20" },
		});
		expect(screen.getByLabelText("Bare")).toBeInTheDocument();
	});
});
