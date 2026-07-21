import { render, screen } from "@testing-library/react";
import { createRef } from "react";
import InputBase from "./InputBase";

describe("InputBase", () => {
	it("forwards object refs for both root and inputRef", () => {
		const rootRef = createRef();
		const inputRef = createRef();
		render(<InputBase ref={rootRef} inputRef={inputRef} defaultValue="x" />);
		expect(rootRef.current).toBeInstanceOf(HTMLInputElement);
		expect(inputRef.current).toBe(rootRef.current);
	});

	it("supports function refs for both root and inputRef", () => {
		const rootNodes = [];
		const inputNodes = [];
		render(
			<InputBase
				ref={(node) => rootNodes.push(node)}
				inputRef={(node) => inputNodes.push(node)}
				aria-label="field"
			/>,
		);
		expect(rootNodes[0]).toBe(screen.getByLabelText("field"));
		expect(inputNodes[0]).toBe(screen.getByLabelText("field"));
	});

	it("merges className, classes, and inputProps", () => {
		render(
			<InputBase
				className="outer"
				classes={{ root: "root-cls", input: "input-cls" }}
				inputProps={{ "data-testid": "ib", placeholder: "ph" }}
				type="search"
			/>,
		);
		const input = screen.getByTestId("ib");
		expect(input).toHaveClass("outer");
		expect(input).toHaveClass("root-cls");
		expect(input).toHaveClass("input-cls");
		expect(input).toHaveAttribute("placeholder", "ph");
		expect(input).toHaveAttribute("type", "search");
	});

	it("ignores missing refs without throwing", () => {
		expect(() => render(<InputBase data-testid="bare" />)).not.toThrow();
		expect(screen.getByTestId("bare")).toBeInTheDocument();
	});
});
