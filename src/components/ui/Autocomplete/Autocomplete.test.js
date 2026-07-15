import { fireEvent, render } from "@testing-library/react";
import Autocomplete from "./Autocomplete";

const options = [
	{ type: "session", label: "Planning" },
	{ type: "article", label: "Roadmap" },
];

describe("Autocomplete", () => {
	it("supports controlled multi-select object options", () => {
		const onChange = jest.fn();
		const onInputChange = jest.fn();
		const { getByRole, getByText } = render(
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

		fireEvent.focus(getByRole("textbox", { name: "Filters" }));
		fireEvent.mouseDown(getByText("Planning"));

		expect(onChange).toHaveBeenCalledWith(null, [options[0]]);
		expect(onInputChange).toHaveBeenCalledWith(null, "");
	});
});
