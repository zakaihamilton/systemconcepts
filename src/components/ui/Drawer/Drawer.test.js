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
});
