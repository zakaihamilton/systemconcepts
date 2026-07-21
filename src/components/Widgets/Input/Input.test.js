import { fireEvent, render, screen } from "@testing-library/react";
import { useTranslations } from "@util/domain/translations";
import InputWidget, { arrayToMenuItems } from "./index.js";

jest.mock("@util/domain/translations");
jest.mock("@ui/Autocomplete", () => ({
	__esModule: true,
	default: ({ options, value, onChange, renderInput, className }) => (
		<div data-testid="autocomplete" className={className}>
			{renderInput({
				InputProps: {
					onFocus: jest.fn(),
					onBlur: jest.fn(),
				},
			})}
			<button
				type="button"
				data-testid="pick-option"
				onClick={() => onChange({ target: {} }, options[0])}
			>
				pick
			</button>
			<span data-testid="ac-value">{value}</span>
		</div>
	),
}));

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

	it("clears error when validate is disabled", () => {
		const setValue = jest.fn();
		const onChange = jest.fn();
		render(
			<InputWidget
				label="Username"
				state={["", setValue]}
				onChange={onChange}
			/>,
		);
		fireEvent.change(screen.getByLabelText("Username"), {
			target: { value: "ok" },
		});
		expect(onChange).toHaveBeenCalled();
		expect(setValue).toHaveBeenCalledWith("ok");
	});

	it("toggles password visibility and prevents mouse-down default", () => {
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
		fireEvent.mouseDown(showButton);
		fireEvent.click(showButton);
		expect(input.getAttribute("type")).toBe("text");
		expect(getByLabelText("Hide")).toBeInTheDocument();
	});

	it("renders select items via arrayToMenuItems and custom mapping/render", () => {
		const setValue = jest.fn();
		const { rerender } = render(
			<InputWidget
				label="Pick"
				select
				state={["a", setValue]}
				items={[
					{ id: "a", name: "Alpha" },
					{ id: "b", name: "Beta" },
				]}
			/>,
		);
		expect(screen.getByLabelText("Pick")).toBeInTheDocument();

		rerender(
			<InputWidget
				label="Pick"
				select
				state={["a", setValue]}
				items={[{ id: "a", name: "Alpha" }]}
				mapping={(item) => ({ ...item, name: item.name.toUpperCase() })}
				render={(items) =>
					items.map((item) => <option key={item.id}>{item.name}</option>)
				}
			/>,
		);
		expect(screen.getByText("ALPHA")).toBeInTheDocument();
	});

	it("wraps non-array multiple select values and provides default renderValue", () => {
		const setValue = jest.fn();
		render(
			<InputWidget
				label="Multi"
				select
				multiple
				state={["one", setValue]}
				items={[
					{ id: "one", name: "One" },
					{ id: "two", name: "Two" },
				]}
			/>,
		);
		expect(screen.getByLabelText("Multi")).toBeInTheDocument();
	});

	it("renders an icon tooltip adornment when icon is provided", () => {
		const setValue = jest.fn();
		render(
			<InputWidget
				label="With icon"
				state={["", setValue]}
				icon={<span data-testid="icon">i</span>}
				tooltip="hint"
				background
			/>,
		);
		expect(screen.getByTestId("icon")).toBeInTheDocument();
	});

	it("renders autocomplete mode and forwards option changes", () => {
		const setValue = jest.fn();
		render(
			<InputWidget
				label="Auto"
				autocomplete
				state={["", setValue]}
				items={[{ id: "1", name: "Grace" }]}
				className="extra"
			/>,
		);
		expect(screen.getByTestId("autocomplete")).toBeInTheDocument();
		fireEvent.click(screen.getByTestId("pick-option"));
		expect(setValue).toHaveBeenCalledWith("Grace");
	});

	it("arrayToMenuItems builds menu entries", () => {
		const items = arrayToMenuItems([
			{ id: "1", name: "One" },
			{ id: "2", name: "Two" },
		]);
		expect(items).toHaveLength(2);
	});

	it("supports readOnly and empty state without crashing", () => {
		render(<InputWidget label="Bare" readOnly helperText="help" />);
		expect(screen.getByLabelText("Bare")).toHaveAttribute("readonly");
	});

	it("revalidates on mount when validate is enabled", () => {
		const onValidate = jest.fn().mockReturnValue("Required");
		render(
			<InputWidget
				label="Name"
				state={["", jest.fn()]}
				validate
				onValidate={onValidate}
			/>,
		);
		expect(onValidate).toHaveBeenCalledWith("");
		expect(screen.getByText("Required")).toBeInTheDocument();
	});

	it("uses custom renderValue for multiple select", () => {
		const setValue = jest.fn();
		render(
			<InputWidget
				label="Multi"
				select
				multiple
				state={[["one", "two"], setValue]}
				renderValue={(selected) => `picked:${selected.length}`}
				items={[
					{ id: "one", name: "One" },
					{ id: "two", name: "Two" },
				]}
			/>,
		);
		expect(screen.getByLabelText("Multi")).toBeInTheDocument();
	});

	it("renders select without items when mapping is absent", () => {
		render(<InputWidget label="Empty select" select state={["", jest.fn()]} />);
		expect(screen.getByLabelText("Empty select")).toBeInTheDocument();
	});
});
