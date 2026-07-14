import { render } from "@testing-library/react";
import { useDeviceType } from "@util/browser/styles";
import { useTranslations } from "@util/domain/translations";
import Toolbar, {
	clearToolbarItemsRegistry,
	registerToolbar,
	ToolbarStore,
	useToolbar,
} from "./index.js";

jest.mock("@util/browser/styles");
jest.mock("@util/domain/translations");
jest.mock("./Item", () => ({ item }) => (
	<div data-testid={`item-${item.id}`}>{item.name}</div>
));
jest.mock("@widgets/Menu", () => ({ children }) => (
	<div data-testid="menu">{children}</div>
));

describe("Toolbar Component", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		clearToolbarItemsRegistry();
		ToolbarStore.update((s) => {
			s.sections = [];
		});
		useTranslations.mockReturnValue({ MENU: "Menu" });
		useDeviceType.mockReturnValue("desktop");
	});

	it("renders nothing if no items are present", () => {
		const { container } = render(<Toolbar />);
		expect(container.querySelector(".visible")).toBeNull();
	});

	it("registers and displays toolbar items", () => {
		registerToolbar("test-section", 1);

		function TestComponent() {
			useToolbar({
				id: "test-section",
				items: [{ id: "item1", name: "Item 1" }],
			});
			return <Toolbar />;
		}

		const { getByTestId } = render(<TestComponent />);
		expect(getByTestId("item-item1")).toBeInTheDocument();
	});

	it("handles menu items correctly", () => {
		registerToolbar("test-section", 1);

		function TestComponent() {
			useToolbar({
				id: "test-section",
				items: [
					{ id: "item1", name: "Item 1", menu: true },
					{ id: "item2", name: "Item 2", menu: true },
				],
			});
			return <Toolbar />;
		}

		const { getByTestId } = render(<TestComponent />);
		expect(getByTestId("menu")).toBeInTheDocument();
	});
});
