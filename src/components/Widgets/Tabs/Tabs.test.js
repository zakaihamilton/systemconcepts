import { render, fireEvent } from "@testing-library/react";
import TabsWidget from "./Tabs.js";
import Tab from "@mui/material/Tab";

describe("TabsWidget Component", () => {
	it("renders children and calls setValue when tab is clicked", () => {
		const setValue = jest.fn();
		const mockState = ["tab2", setValue];

		const { getByRole } = render(
			<TabsWidget state={mockState}>
				<Tab value="tab1" label="Tab 1" />
				<Tab value="tab2" label="Tab 2" />
			</TabsWidget>
		);

		const tab1Button = getByRole("tab", { name: "Tab 1" });
		const tab2Button = getByRole("tab", { name: "Tab 2" });

		expect(tab2Button).toHaveAttribute("aria-selected", "true");
		expect(tab1Button).toHaveAttribute("aria-selected", "false");

		fireEvent.click(tab1Button);
		expect(setValue).toHaveBeenCalledWith("tab1");
	});

	it("falls back to false if value is not found in children props", () => {
		const mockState = ["invalid-tab", jest.fn()];
		const { getByRole } = render(
			<TabsWidget state={mockState}>
				<Tab value="tab1" label="Tab 1" />
				<Tab value="tab2" label="Tab 2" />
			</TabsWidget>
		);
		const tab1Button = getByRole("tab", { name: "Tab 1" });
		expect(tab1Button).toHaveAttribute("aria-selected", "false");
	});
});
