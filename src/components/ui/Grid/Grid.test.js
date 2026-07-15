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
});
