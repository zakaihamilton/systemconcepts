import { render } from "@testing-library/react";
import Grid from "./Grid";

describe("Grid", () => {
	it("renders a 12-column container", () => {
		const { container } = render(
			<Grid container spacing={3} data-testid="grid-container">
				<Grid size={12}>Content</Grid>
			</Grid>,
		);

		const gridContainer = container.firstChild;
		expect(gridContainer).toHaveStyle({ gap: "24px" });
		expect(gridContainer.className).toMatch(/container/);
		expect(container.querySelector('[class*="spanXs12"]')).toBeTruthy();
	});

	it("supports the legacy xs prop with item", () => {
		const { container } = render(
			<Grid container>
				<Grid item xs={6}>
					Half
				</Grid>
			</Grid>,
		);

		expect(container.querySelector('[class*="spanXs6"]')).toBeTruthy();
	});

	it("supports responsive size objects", () => {
		const { container } = render(
			<Grid container>
				<Grid size={{ xs: 12, sm: 6 }}>Responsive</Grid>
			</Grid>,
		);

		const item = container.querySelector('[class*="spanXs12"]');
		expect(item).toBeTruthy();
		expect(item.className).toMatch(/spanSm6/);
	});

	it("does not leak grid props to the DOM", () => {
		const { container } = render(
			<Grid container spacing={2}>
				<Grid size={12}>Child</Grid>
			</Grid>,
		);

		expect(container.firstChild).not.toHaveAttribute("container");
		expect(container.firstChild).not.toHaveAttribute("spacing");
		expect(container.lastChild).not.toHaveAttribute("size");
	});

	it("sets custom column templates when container xs is not 12", () => {
		const { container } = render(
			<Grid container xs={4} style={{ color: "red" }}>
				item
			</Grid>,
		);
		expect(container.firstChild.style.gridTemplateColumns).toBe(
			"repeat(3, minmax(0, 1fr))",
		);
		expect(container.firstChild.style.color).toBe("red");
	});

	it("merges size object overrides with legacy breakpoint props", () => {
		const { container } = render(
			<Grid size={{ xs: 6 }} sm={4} md={3}>
				cell
			</Grid>,
		);
		const el = container.firstChild;
		expect(el.className).toMatch(/spanXs6/);
		expect(el.className).toMatch(/spanSm4/);
		expect(el.className).toMatch(/spanMd3/);
	});

	it("ignores falsy span values", () => {
		const { container } = render(<Grid item xs={0} sm={null} md={undefined} />);
		expect(container.firstChild.className).toMatch(/item/);
	});

	it("renders a plain div when neither container nor item props apply", () => {
		const { container } = render(<Grid className="plain">x</Grid>);
		expect(container.firstChild).toHaveClass("plain");
	});
});
