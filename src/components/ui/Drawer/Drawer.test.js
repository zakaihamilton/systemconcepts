import { render, screen } from "@testing-library/react";
import Drawer from "./Drawer";

describe("Drawer", () => {
	it("keeps a closed persistent drawer inert", () => {
		render(
			<Drawer open={false} variant="persistent">
				<button type="button">Hidden action</button>
			</Drawer>,
		);
		const drawer = screen.getByRole("complementary", { hidden: true });
		expect(drawer).toHaveAttribute("aria-hidden", "true");
		expect(drawer).toHaveAttribute("inert", "");
	});

	it("supports a top anchor", () => {
		render(
			<Drawer open anchor="top">
				<button type="button">Top action</button>
			</Drawer>,
		);
		expect(screen.getByRole("complementary")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Top action" })).toBeInTheDocument();
	});

	it("raises overlay z-index with the drawer", () => {
		const { container } = render(
			<Drawer open style={{ zIndex: 1500 }}>
				<button type="button">Raised</button>
			</Drawer>,
		);
		const overlay = container.querySelector("[class*='overlay']");
		expect(overlay).toHaveStyle({ zIndex: "1499" });
		expect(screen.getByRole("complementary")).toHaveStyle({ zIndex: "1500" });
	});
});
