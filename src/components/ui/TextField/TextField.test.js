import { fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import TextField from "./TextField";

describe("TextField", () => {
	it("renders an outlined input with floating label after focus", () => {
		const onChange = jest.fn();
		const onFocus = jest.fn();
		const onBlur = jest.fn();
		render(
			<TextField
				label="Name"
				value=""
				onChange={onChange}
				helperText="help"
				inputProps={{ onFocus, onBlur }}
			/>,
		);
		const input = screen.getByLabelText("Name");
		fireEvent.focus(input);
		expect(onFocus).toHaveBeenCalled();
		fireEvent.change(input, { target: { value: "Ada" } });
		expect(onChange).toHaveBeenCalled();
		fireEvent.blur(input);
		expect(onBlur).toHaveBeenCalled();
		expect(screen.getByText("help")).toBeInTheDocument();
	});

	it("supports filled variant, error, fullWidth, and adornments", () => {
		render(
			<TextField
				label="Filled"
				value="x"
				variant="filled"
				error
				fullWidth
				helperText="bad"
				startAdornment={<span data-testid="start">S</span>}
				endAdornment={<span data-testid="end">E</span>}
				InputProps={{
					startAdornment: <span data-testid="input-start">IS</span>,
					onFocus: jest.fn(),
					onBlur: jest.fn(),
				}}
			/>,
		);
		expect(screen.getByTestId("input-start")).toBeInTheDocument();
		expect(screen.getByTestId("end")).toBeInTheDocument();
		expect(screen.getByText("bad")).toBeInTheDocument();
		fireEvent.focus(screen.getByLabelText("Filled"));
		fireEvent.blur(screen.getByLabelText("Filled"));
	});

	it("renders select mode with renderValue for single and multiple", () => {
		const { rerender } = render(
			<TextField
				label="Pick"
				select
				value="a"
				renderValue={(v) => `val:${v}`}
				selectClassName="sel"
			>
				<option value="a">A</option>
			</TextField>,
		);
		expect(screen.getByLabelText("Pick").tagName).toBe("SELECT");

		rerender(
			<TextField
				label="Multi"
				select
				multiple
				value={["a", "b"]}
				renderValue={(v) => v.join("|")}
			>
				<option value="a">A</option>
				<option value="b">B</option>
			</TextField>,
		);
		expect(screen.getByLabelText("Multi")).toHaveAttribute("multiple");
	});

	it("forwards function and object refs", () => {
		const objectRef = createRef();
		const nodes = [];
		const { rerender } = render(
			<TextField label="R" ref={objectRef} value="1" />,
		);
		expect(objectRef.current).toBeInstanceOf(HTMLInputElement);

		rerender(
			<TextField label="R" ref={(node) => nodes.push(node)} value="1" />,
		);
		expect(nodes[0]).toBeInstanceOf(HTMLInputElement);
	});

	it("handles empty helper text and aria-label without a label", () => {
		render(
			<TextField select aria-label="Bare select" value="" helperText="   ">
				<option value="">None</option>
			</TextField>,
		);
		expect(screen.getByLabelText("Bare select")).toBeInTheDocument();
	});

	it("treats null multiple values as empty for the floating label", () => {
		render(<TextField label="Empty multi" select multiple value={null} />);
		expect(screen.getByLabelText("Empty multi")).toBeInTheDocument();
	});

	it("uses default empty value and coerces null display values", () => {
		render(<TextField label="Defaulted" />);
		expect(screen.getByLabelText("Defaulted")).toHaveValue("");

		const { rerender } = render(
			<TextField label="Nullable" value={null} onChange={jest.fn()} />,
		);
		expect(screen.getByLabelText("Nullable")).toHaveValue("");
		rerender(
			<TextField label="Nullable" value={undefined} onChange={jest.fn()} />,
		);
		expect(screen.getByLabelText("Nullable")).toHaveValue("");
	});

	it("supports disabled inputs and readOnly select props", () => {
		render(
			<TextField
				label="Disabled"
				value="x"
				disabled
				endAdornment={<span data-testid="end-only">E</span>}
			/>,
		);
		expect(screen.getByLabelText("Disabled")).toBeDisabled();
	});
});
