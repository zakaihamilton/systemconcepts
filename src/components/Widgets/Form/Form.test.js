import { fireEvent, render } from "@testing-library/react";
import Form, { FormGroup } from "./index.js";

describe("Form Widget", () => {
	const MockInput = ({ state }) => {
		const [value, setValue] = state;
		return (
			<input
				data-testid="mock-input"
				value={value || ""}
				onChange={(e) => setValue(e.target.value)}
			/>
		);
	};

	it("renders form and children when data is present and not loading", () => {
		const { getByTestId, getByText } = render(
			<Form data={{}} actions={<button>Submit</button>}>
				<div data-testid="child">Child</div>
			</Form>,
		);
		expect(getByTestId("child")).toBeInTheDocument();
		expect(getByText("Submit")).toBeInTheDocument();
	});

	it("renders progress when loading", () => {
		render(<Form loading={true} />);
		// Form uses Progress widget which we can mock or just check for presence
		expect(document.querySelector('[role="progressbar"]')).toBeInTheDocument();
	});

	it("FormGroup passes state to children", () => {
		const setRecord = jest.fn();
		const record = { name: "Initial" };
		const { getByTestId } = render(
			<FormGroup record={record} setRecord={setRecord}>
				<MockInput id="name" />
			</FormGroup>,
		);

		const input = getByTestId("mock-input");
		expect(input.value).toBe("Initial");

		fireEvent.change(input, { target: { value: "New Name" } });
		expect(setRecord).toHaveBeenCalled();
	});
});
