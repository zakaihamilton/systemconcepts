import { fireEvent, render, screen } from "@testing-library/react";
import { useDeviceType } from "@util/browser/styles";
import { useTranslations } from "@util/domain/translations";
import Toolbar, {
	clearToolbarItemsRegistry,
	registerToolbar,
	ToolbarStore,
	useToolbar,
} from "../Toolbar";

jest.mock("@util/browser/styles");
jest.mock("@util/domain/translations");
jest.mock("@components/Main", () => ({
	MainStore: {
		useState: () => ({ hash: "#groups" }),
	},
}));

describe("Toolbar menu interactions", () => {
	beforeEach(() => {
		clearToolbarItemsRegistry();
		ToolbarStore.update((s) => {
			s.sections = [];
		});
		useTranslations.mockReturnValue({ MENU: "Menu" });
		useDeviceType.mockReturnValue("desktop");
	});

	it("opens overflow menu and runs item onClick", () => {
		registerToolbar("Groups", 1);
		const onClick = jest.fn();

		function TestComponent() {
			useToolbar({
				id: "Groups",
				items: [
					{
						id: "sync",
						name: "Sync Sessions",
						onClick,
						location: "header",
						menu: true,
					},
					{
						id: "import",
						name: "Import",
						onClick: jest.fn(),
						location: "header",
						menu: true,
					},
				],
			});
			return <Toolbar location="header" collapsable />;
		}

		render(<TestComponent />);

		fireEvent.click(screen.getByRole("button", { name: "Menu" }));
		expect(screen.getByRole("menu")).toBeInTheDocument();

		fireEvent.click(screen.getByRole("menuitem", { name: "Sync Sessions" }));
		expect(onClick).toHaveBeenCalledTimes(1);
	});

	it("runs onClick for direct toolbar item", () => {
		registerToolbar("Test", 1);
		const onClick = jest.fn();

		function TestComponent() {
			useToolbar({
				id: "Test",
				items: [
					{
						id: "sync",
						name: "Sync",
						icon: <span />,
						onClick,
						location: "header",
					},
				],
			});
			return <Toolbar location="header" collapsable />;
		}

		render(<TestComponent />);

		fireEvent.click(screen.getByRole("button", { name: "Sync" }));
		expect(onClick).toHaveBeenCalledTimes(1);
	});
});
