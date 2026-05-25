import { MainStore } from "@components/Main";
import { fireEvent, render, screen } from "@testing-library/react";
import { useDeviceType } from "@util/browser/styles";
import { setHash } from "@util/domain/views";
import BreadcrumbsWidget, { BreadcrumbItem } from "./index.js";

jest.mock("@components/Main", () => ({
	MainStore: {
		useState: jest.fn(),
	},
}));
jest.mock("@util/browser/styles");
jest.mock("@util/domain/views");
jest.mock("../AppBar/SidebarIcon", () => () => (
	<div data-testid="sidebar-icon" />
));
jest.mock("@components/Toolbar", () => () => <div data-testid="toolbar" />);

describe("BreadcrumbItem Component", () => {
	beforeEach(() => {
		MainStore.useState.mockReturnValue({ direction: "ltr" });
		useDeviceType.mockReturnValue("desktop");
	});

	it("renders label correctly when it is the last item", () => {
		render(
			<BreadcrumbItem
				index={1}
				count={2}
				label="Test Page"
				name="test"
				href="#test"
			/>,
		);
		expect(screen.getByText("Test Page")).toBeInTheDocument();
	});

	it("calls setHash when clicked", () => {
		render(<BreadcrumbItem index={0} count={2} label="Home" href="#home" />);
		fireEvent.click(screen.getByRole("link"));
		expect(setHash).toHaveBeenCalledWith("#home");
	});
});

describe("BreadcrumbsWidget Component", () => {
	beforeEach(() => {
		useDeviceType.mockReturnValue("desktop");
		MainStore.useState.mockReturnValue({ direction: "ltr" });
	});

	it("renders breadcrumbs", () => {
		const items = [
			{ id: "home", name: "Home", url: "home" },
			{ id: "sub", name: "Sub", url: "sub" },
		];
		render(<BreadcrumbsWidget items={items} />);
		// On desktop, the first item (Home) might not show its label if it's not last
		// but the last item (Sub) definitely should.
		expect(screen.getByText("Sub")).toBeInTheDocument();
	});
});
