import { render } from "@testing-library/react";
import { useDeviceType } from "@util/browser/styles";
import { useTranslations } from "@util/domain/translations";
import Toolbar, {
	clearToolbarItemsRegistry,
	registerToolbar,
	ToolbarStore,
	useToolbar,
} from "./Toolbar";

jest.mock("@util/browser/styles");
jest.mock("@util/domain/translations");
jest.mock("./Item", () => ({ item }) => (
	<div data-testid={`item-${item.id}`}>{item.name}</div>
));
jest.mock("@widgets/Menu", () => ({ children }) => (
	<div data-testid="menu">{children}</div>
));

describe("Toolbar registry", () => {
	beforeEach(() => {
		clearToolbarItemsRegistry();
		ToolbarStore.update((s) => {
			s.sections = [];
		});
		useTranslations.mockReturnValue({ MENU: "Menu" });
		useDeviceType.mockReturnValue("desktop");
	});

	it("preserves onClick handlers outside of pullstate", () => {
		registerToolbar("test-section", 1);
		const onClick = jest.fn();

		function TestComponent() {
			useToolbar({
				id: "test-section",
				items: [{ id: "sync", name: "Sync", onClick }],
			});
			return <Toolbar location="header" />;
		}

		render(<TestComponent />);

		const storedItems = ToolbarStore.getRawState().sections[0].items;
		expect(storedItems).toEqual([]);
	});
});
