import { fireEvent, render, screen } from "@testing-library/react";
import { useDeviceType } from "@util/browser/styles";
import { useTranslations } from "@util/domain/translations";
import Toolbar, {
	clearToolbarItemsRegistry,
	registerToolbar,
	ToolbarStore,
	useToolbar,
	useToolbarItems,
} from "./index.js";

jest.mock("@util/browser/styles");
jest.mock("@util/domain/translations");
jest.mock("./Item", () => ({ item }) => (
	<div data-testid={`item-${item.id}`}>{item.name}</div>
));
jest.mock(
	"@widgets/Menu",
	() =>
		({ open, onClose, items }) =>
			open ? (
				<div data-testid="menu">
					{items.map((item) => (
						<button key={item.id} type="button" onClick={onClose}>
							{item.name}
						</button>
					))}
				</div>
			) : null,
);
jest.mock(
	"@widgets/Tooltip",
	() =>
		({ children }) =>
			children,
);
jest.mock("@components/Main", () => {
	const { Store } = require("pullstate");
	return { MainStore: new Store({ hash: "#home" }) };
});

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
		expect(container).toBeEmptyDOMElement();
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

		render(<TestComponent />);
		fireEvent.click(screen.getByLabelText("Menu"));
		expect(screen.getByTestId("menu")).toBeInTheDocument();
	});

	it("does not re-register an existing toolbar id", () => {
		registerToolbar("dup", 1);
		registerToolbar("dup", 2);
		expect(
			ToolbarStore.getRawState().sections.filter((s) => s.id === "dup"),
		).toHaveLength(1);
	});

	it("shows a single overflow item directly without the menu button", () => {
		registerToolbar("sec", 1);
		function TestComponent() {
			useToolbar({
				id: "sec",
				items: [{ id: "only", name: "Only", menu: true }],
			});
			return <Toolbar />;
		}
		render(<TestComponent />);
		expect(screen.getByTestId("item-only")).toBeInTheDocument();
		expect(screen.queryByTestId("menu")).not.toBeInTheDocument();
	});

	it("collapses undefined-menu items on mobile when collapsable", () => {
		useDeviceType.mockReturnValue("phone");
		registerToolbar("sec", 1);
		function TestComponent() {
			useToolbar({
				id: "sec",
				items: [
					{ id: "a", name: "A" },
					{ id: "b", name: "B" },
				],
			});
			return <Toolbar location={undefined} collapsable />;
		}
		render(<TestComponent />);
		expect(screen.getByLabelText("Menu")).toBeInTheDocument();
		fireEvent.click(screen.getByLabelText("Menu"));
		expect(screen.getByTestId("menu")).toBeInTheDocument();
	});

	it("keeps nested and element items on the direct toolbar", () => {
		registerToolbar("sec", 1);
		function TestComponent() {
			useToolbar({
				id: "sec",
				items: [
					{ id: "nested", name: "Nested", items: [{ id: "child" }] },
					{ id: "el", name: "El", element: <span>x</span> },
					{ id: "plain", name: "Plain", menu: false },
				],
			});
			return <Toolbar collapsable />;
		}
		render(<TestComponent />);
		expect(screen.getByTestId("item-nested")).toBeInTheDocument();
		expect(screen.getByTestId("item-el")).toBeInTheDocument();
		expect(screen.getByTestId("item-plain")).toBeInTheDocument();
	});

	it("renders dividers before and after when requested", () => {
		registerToolbar("sec", 1);
		function TestComponent() {
			useToolbar({
				id: "sec",
				items: [{ id: "a", name: "A" }],
			});
			return <Toolbar dividerBefore dividerAfter />;
		}
		const { container } = render(<TestComponent />);
		expect(
			container.querySelectorAll("hr, [class*='divider']").length,
		).toBeGreaterThan(0);
	});

	it("filters items by location string and array", () => {
		registerToolbar("sec", 1);
		ToolbarStore.update((s) => {
			const section = s.sections.find((item) => item.id === "sec");
			section.used = 1;
			section.visible = true;
		});

		function Harness({ location }) {
			useToolbar({
				id: "sec",
				items: [
					{ id: "footer", name: "F", location: "footer" },
					{ id: "header", name: "H", location: "header" },
					{ id: "none", name: "N" },
				],
			});
			const items = useToolbarItems({ location });
			return (
				<ul>
					{items.map((item) => (
						<li key={item.id}>{item.id}</li>
					))}
				</ul>
			);
		}

		const { rerender } = render(<Harness location="footer" />);
		expect(screen.getByText("footer")).toBeInTheDocument();
		expect(screen.queryByText("header")).not.toBeInTheDocument();

		rerender(<Harness location={["header", undefined]} />);
		expect(screen.getByText("header")).toBeInTheDocument();
		expect(screen.getByText("none")).toBeInTheDocument();
	});

	it("hides invisible or unused sections and sorts by sortKey", () => {
		registerToolbar("b", 2);
		registerToolbar("a", 1);
		function TestComponent() {
			useToolbar({
				id: "b",
				items: [{ id: "second", name: "Second", sortKey: 2 }],
			});
			useToolbar({
				id: "a",
				items: [{ id: "first", name: "First", sortKey: 1 }],
				visible: true,
			});
			return <Toolbar />;
		}
		render(<TestComponent />);
		const items = screen.getAllByTestId(/item-/);
		expect(items[0]).toHaveAttribute("data-testid", "item-first");
		expect(items[1]).toHaveAttribute("data-testid", "item-second");
	});

	it("uses top tooltip placement for footer and mobile locations", () => {
		registerToolbar("sec", 1);
		function TestComponent() {
			useToolbar({
				id: "sec",
				items: [{ id: "a", name: "A", location: "footer" }],
			});
			return <Toolbar location="footer" />;
		}
		render(<TestComponent />);
		expect(screen.getByTestId("item-a")).toBeInTheDocument();
	});

	it("updates items when depends change and cleans up on unmount", () => {
		registerToolbar("sec", 1);
		function TestComponent({ label }) {
			useToolbar({
				id: "sec",
				items: [{ id: "a", name: label }],
				depends: [label],
			});
			return <Toolbar />;
		}
		const { rerender, unmount } = render(<TestComponent label="One" />);
		expect(screen.getByText("One")).toBeInTheDocument();
		rerender(<TestComponent label="Two" />);
		expect(screen.getByText("Two")).toBeInTheDocument();
		unmount();
		expect(
			ToolbarStore.getRawState().sections.find((s) => s.id === "sec").used,
		).toBe(0);
	});
});
