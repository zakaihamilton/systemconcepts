import { fireEvent, render } from "@testing-library/react";
import EditorWidget from "./Editor.js";

describe("Editor Widget", () => {
	it("focuses textarea on mount and calls setValue on change", () => {
		const setValue = jest.fn();
		const mockState = ["initial content", setValue];

		const { getByRole } = render(<EditorWidget state={mockState} />);
		const textarea = getByRole("textbox");

		// Verify auto focus
		expect(document.activeElement).toBe(textarea);
		expect(textarea.value).toBe("initial content");

		// Trigger change event
		fireEvent.change(textarea, { target: { value: "new content" } });
		expect(setValue).toHaveBeenCalledWith("new content");
	});
});
