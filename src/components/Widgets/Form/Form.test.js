import { fireEvent, render, screen } from "@testing-library/react";
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
		const updater = setRecord.mock.calls[0][0];
		expect(updater({ name: "Initial" })).toEqual({ name: "New Name" });
	});

	it("FormGroup supports nested field paths and skips falsy children", () => {
		const setRecord = jest.fn((fn) => fn({ user: { name: "Ada" } }));
		const NestedInput = ({ state }) => {
			const [value, setValue] = state;
			return (
				<input
					data-testid="nested"
					value={value || ""}
					onChange={(e) => setValue(e.target.value)}
				/>
			);
		};
		const { getByTestId } = render(
			<FormGroup
				record={{ user: { name: "Ada" } }}
				setRecord={setRecord}
				validate
			>
				{null}
				{false}
				<NestedInput id="user" field="name" />
			</FormGroup>,
		);
		fireEvent.change(getByTestId("nested"), { target: { value: "Bob" } });
		expect(setRecord).toHaveBeenCalled();
		const updater = setRecord.mock.calls[0][0];
		expect(updater({ user: { name: "Ada" } })).toEqual({
			user: { name: "Bob" },
		});
	});

	it("Form skips falsy children and hides the form without data", () => {
		const { queryByText, rerender } = render(
			<Form actions={<button type="button">Go</button>}>
				{null}
				<div>Child</div>
			</Form>,
		);
		expect(queryByText("Child")).not.toBeInTheDocument();
		expect(queryByText("Go")).toBeInTheDocument();

		rerender(
			<Form data={{}} validate actions={<button type="button">Go</button>}>
				{null}
				<div>Child</div>
			</Form>,
		);
		expect(queryByText("Child")).toBeInTheDocument();
	});

	it("passes validate to cloned Form children", () => {
		const Child = ({ validate }) => (
			<div data-testid="validated">{validate ? "yes" : "no"}</div>
		);
		render(
			<Form data={{}} validate>
				<Child />
			</Form>,
		);
		expect(screen.getByTestId("validated")).toHaveTextContent("yes");
	});
});
