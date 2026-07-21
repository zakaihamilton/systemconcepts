import { act, fireEvent, render, screen } from "@testing-library/react";
import Autocomplete from "./Autocomplete.js";

const options = [
	{ type: "session", label: "Planning" },
	{ type: "article", label: "Roadmap" },
	{ type: "session", label: "Review" },
];

describe("Autocomplete", () => {
	it("supports controlled multi-select object options", () => {
		const onChange = jest.fn();
		const onInputChange = jest.fn();
		render(
			<Autocomplete
				multiple
				options={options}
				value={[]}
				inputValue="plan"
				onChange={onChange}
				onInputChange={onInputChange}
				getOptionLabel={(option) => option.label}
				filterOptions={(items, { inputValue }) =>
					items.filter((item) =>
						item.label.toLowerCase().includes(inputValue.toLowerCase()),
					)
				}
				renderOption={({ key, ...props }, option) => (
					<li key={key} {...props}>
						{option.label}
					</li>
				)}
				renderInput={({ InputProps, ...params }) => (
					<input
						aria-label="Filters"
						{...params}
						onFocus={InputProps.onFocus}
						onBlur={InputProps.onBlur}
					/>
				)}
			/>,
		);

		fireEvent.focus(screen.getByRole("textbox", { name: "Filters" }));
		fireEvent.mouseDown(screen.getByText("Planning"));

		expect(onChange).toHaveBeenCalledWith(null, [options[0]]);
		expect(onInputChange).toHaveBeenCalledWith(null, "");
	});

	it("supports uncontrolled single select with default filter", () => {
		const onChange = jest.fn();
		render(
			<Autocomplete
				options={["Apple", "Banana", "Apricot"]}
				onChange={onChange}
				renderInput={({ InputProps, value, onChange: onInput }) => (
					<input
						aria-label="Fruit"
						value={value}
						onChange={onInput}
						onFocus={InputProps.onFocus}
						onBlur={InputProps.onBlur}
					/>
				)}
			/>,
		);

		const input = screen.getByRole("textbox", { name: "Fruit" });
		fireEvent.focus(input);
		fireEvent.change(input, { target: { value: "ap" } });
		expect(screen.getByText("Apple")).toBeInTheDocument();
		expect(screen.getByText("Apricot")).toBeInTheDocument();
		expect(screen.queryByText("Banana")).not.toBeInTheDocument();
		fireEvent.mouseDown(screen.getByText("Apple"));
		expect(onChange).toHaveBeenCalledWith(null, "Apple");
	});

	it("dedupes multiple selections and deletes via renderValue", () => {
		const onChange = jest.fn();
		const value = [options[0], options[1]];
		render(
			<Autocomplete
				multiple
				options={options}
				value={value}
				onChange={onChange}
				getOptionLabel={(o) => o.label}
				isOptionEqualToValue={(a, b) => a.label === b.label}
				renderValue={(selected, getItemProps) =>
					selected.map((opt, index) => {
						const props = getItemProps({ index });
						return (
							<button
								key={props.key}
								type="button"
								data-testid={`chip-${opt.label}`}
								onClick={props.onDelete}
							>
								{opt.label}
							</button>
						);
					})
				}
				renderInput={({ InputProps, ...params }) => (
					<div>
						{InputProps.startAdornment}
						<input
							aria-label="Multi"
							{...params}
							onFocus={InputProps.onFocus}
							onBlur={InputProps.onBlur}
						/>
					</div>
				)}
			/>,
		);

		fireEvent.focus(screen.getByRole("textbox", { name: "Multi" }));
		fireEvent.mouseDown(screen.getByRole("option", { name: "Planning" }));
		expect(onChange).toHaveBeenCalledWith(null, [options[1], options[0]]);

		fireEvent.click(screen.getByTestId("chip-Planning"));
		expect(onChange).toHaveBeenCalledWith(null, [options[1]]);
	});

	it("closes listbox after blur timeout", () => {
		jest.useFakeTimers();
		render(
			<Autocomplete
				options={["One"]}
				renderInput={({ InputProps, ...params }) => (
					<input
						aria-label="Close"
						{...params}
						onFocus={InputProps.onFocus}
						onBlur={InputProps.onBlur}
					/>
				)}
			/>,
		);
		const input = screen.getByRole("textbox", { name: "Close" });
		fireEvent.focus(input);
		expect(screen.getByRole("listbox")).toBeInTheDocument();
		fireEvent.blur(input);
		act(() => {
			jest.advanceTimersByTime(150);
		});
		expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
		jest.useRealTimers();
	});

	it("handles non-array multiple value as empty", () => {
		render(
			<Autocomplete
				multiple
				value={null}
				options={["A"]}
				renderInput={({ InputProps, ...params }) => (
					<input
						aria-label="Null"
						{...params}
						onFocus={InputProps.onFocus}
						onBlur={InputProps.onBlur}
					/>
				)}
			/>,
		);
		fireEvent.focus(screen.getByRole("textbox", { name: "Null" }));
		fireEvent.mouseDown(screen.getByText("A"));
	});
});
