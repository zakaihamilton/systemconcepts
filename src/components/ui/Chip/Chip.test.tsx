import { fireEvent, render, screen } from "@testing-library/react";
import Chip from "./Chip";

describe("Chip", () => {
	it("renders an interactive toggle chip as a pressed button", () => {
		const onClick = jest.fn();
		render(<Chip label="AI" variant="filled" pressed onClick={onClick} />);
		const chip = screen.getByRole("button", { name: "AI" });
		expect(chip).toHaveAttribute("aria-pressed", "true");
		fireEvent.click(chip);
		expect(onClick).toHaveBeenCalledTimes(1);
	});

	it("keeps long labels on a single line for ellipsis", () => {
		const { container } = render(
			<Chip label="A very long filter label that should truncate" />,
		);
		expect(container.querySelector("span span")).toHaveTextContent(
			"A very long filter label that should truncate",
		);
	});

	it("does not expose a non-toggle action as pressed", () => {
		render(<Chip label="Copy tag" onClick={jest.fn()} />);
		expect(
			screen.getByRole("button", { name: "Copy tag" }),
		).not.toHaveAttribute("aria-pressed");
	});
});
