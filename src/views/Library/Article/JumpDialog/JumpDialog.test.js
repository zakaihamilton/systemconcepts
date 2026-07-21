import { fireEvent, render, screen } from "@testing-library/react";
import { useTranslations } from "@util/domain/translations";
import JumpDialog from "./JumpDialog.js";

jest.mock("@util/domain/translations", () => ({
	useTranslations: jest.fn(),
}));
jest.mock(
	"@ui/Dialog",
	() =>
		({ open, onClose, children }) =>
			open ? (
				<div data-testid="dialog">
					<button type="button" data-testid="dialog-close" onClick={onClose}>
						x
					</button>
					{children}
				</div>
			) : null,
);
jest.mock("@ui/DialogTitle", () => ({ children }) => <h2>{children}</h2>);
jest.mock("@ui/DialogContent", () => ({ children }) => <div>{children}</div>);
jest.mock("@ui/DialogActions", () => ({ children }) => <div>{children}</div>);
jest.mock("@ui/Tabs", () => ({ children, onChange, value }) => (
	<div data-testid="tabs" data-value={value}>
		{Array.isArray(children)
			? children.map((child, i) => (
					<button
						key={i}
						type="button"
						data-testid={`tab-${i}`}
						onClick={() => onChange(null, i)}
					>
						{child.props.label}
					</button>
				))
			: children}
	</div>
));
jest.mock("@ui/Tab", () => ({ label }) => <span>{label}</span>);
jest.mock(
	"@ui/TextField",
	() =>
		({ label, value, onChange, onKeyDown, inputRef, id }) => (
			<input
				aria-label={label}
				id={id}
				value={value}
				onChange={onChange}
				onKeyDown={onKeyDown}
				ref={inputRef}
			/>
		),
);
jest.mock("@ui/Button", () => ({ children, onClick }) => (
	<button type="button" onClick={onClick}>
		{children}
	</button>
));
jest.mock("@ui/Box", () => ({ children }) => <div>{children}</div>);

describe("JumpDialog", () => {
	const translations = {
		JUMP_TO: "Jump to",
		PARAGRAPH: "Paragraph",
		PAGE: "Page",
		PARAGRAPH_NUMBER: "Paragraph #",
		PAGE_NUMBER: "Page #",
		CANCEL: "Cancel",
		GO: "Go",
	};

	beforeEach(() => {
		jest.clearAllMocks();
		jest.useFakeTimers();
		useTranslations.mockReturnValue(translations);
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	it("submits valid paragraph and clears input", () => {
		const onSubmit = jest.fn();
		render(
			<JumpDialog
				open
				onClose={jest.fn()}
				onSubmit={onSubmit}
				maxParagraphs={10}
				maxPage={5}
			/>,
		);

		const input = screen.getByLabelText(/Paragraph #/);
		fireEvent.change(input, { target: { value: "3" } });
		fireEvent.click(screen.getByText("Go"));
		expect(onSubmit).toHaveBeenCalledWith("paragraph", 3);
		expect(input).toHaveValue("");
	});

	it("switches to page tab and submits page", () => {
		const onSubmit = jest.fn();
		render(
			<JumpDialog
				open
				onClose={jest.fn()}
				onSubmit={onSubmit}
				maxParagraphs={10}
				maxPage={5}
				title="Custom"
				pageLabel="Pg"
				pageNumberLabel="Pg #"
			/>,
		);

		expect(screen.getByText("Custom")).toBeInTheDocument();
		fireEvent.click(screen.getByTestId("tab-1"));
		const input = screen.getByLabelText(/Pg #/);
		fireEvent.change(input, { target: { value: "2" } });
		fireEvent.keyDown(input, { key: "Enter" });
		expect(onSubmit).toHaveBeenCalledWith("page", 2);
	});

	it("ignores invalid paragraph and page values", () => {
		const onSubmit = jest.fn();
		render(
			<JumpDialog
				open
				onClose={jest.fn()}
				onSubmit={onSubmit}
				maxParagraphs={3}
				maxPage={2}
			/>,
		);
		fireEvent.change(screen.getByLabelText(/Paragraph #/), {
			target: { value: "99" },
		});
		fireEvent.click(screen.getByText("Go"));
		expect(onSubmit).not.toHaveBeenCalled();

		fireEvent.click(screen.getByTestId("tab-1"));
		fireEvent.change(screen.getByLabelText(/Page #/), {
			target: { value: "abc" },
		});
		fireEvent.click(screen.getByText("Go"));
		expect(onSubmit).not.toHaveBeenCalled();
	});

	it("defaults to page tab when no paragraphs", () => {
		render(
			<JumpDialog
				open
				onClose={jest.fn()}
				onSubmit={jest.fn()}
				maxParagraphs={0}
				maxPage={5}
			/>,
		);
		expect(screen.queryByTestId("tabs")).not.toBeInTheDocument();
		expect(screen.getByLabelText(/Page #/)).toBeInTheDocument();
	});

	it("calls onClose from cancel", () => {
		const onClose = jest.fn();
		render(
			<JumpDialog
				open
				onClose={onClose}
				onSubmit={jest.fn()}
				maxParagraphs={1}
				maxPage={1}
			/>,
		);
		fireEvent.click(screen.getByText("Cancel"));
		expect(onClose).toHaveBeenCalled();
	});

	it("focuses input when opened", () => {
		const focus = jest.fn();
		jest.spyOn(HTMLElement.prototype, "focus").mockImplementation(focus);
		render(
			<JumpDialog
				open
				onClose={jest.fn()}
				onSubmit={jest.fn()}
				maxParagraphs={5}
				maxPage={0}
			/>,
		);
		jest.advanceTimersByTime(100);
		expect(focus).toHaveBeenCalled();
		HTMLElement.prototype.focus.mockRestore();
	});
});
