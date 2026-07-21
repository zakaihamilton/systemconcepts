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
jest.mock("@widgets/Tooltip", () => ({ children, title }) => (
	<div data-title={title || ""}>{children}</div>
));

describe("BreadcrumbItem Component", () => {
	beforeEach(() => {
		MainStore.useState.mockReturnValue({ direction: "ltr" });
		useDeviceType.mockReturnValue("desktop");
		jest.clearAllMocks();
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

	it("prevents navigation for static items", () => {
		render(
			<BreadcrumbItem
				index={0}
				count={2}
				label="Static"
				href="#static"
				static
			/>,
		);
		fireEvent.click(screen.getByRole("link"));
		expect(setHash).not.toHaveBeenCalled();
	});

	it("invokes custom onClick", () => {
		const onClick = jest.fn();
		render(
			<BreadcrumbItem
				index={0}
				count={2}
				label="Custom"
				href="#c"
				onClick={onClick}
			/>,
		);
		fireEvent.click(screen.getByRole("link"));
		expect(onClick).toHaveBeenCalled();
		expect(setHash).not.toHaveBeenCalled();
	});

	it("opens a menu for the last item with menuItems", () => {
		const menuClick = jest.fn();
		render(
			<BreadcrumbItem
				index={1}
				count={2}
				label="Last"
				href="#last"
				menuItems={[
					{ name: "Action", onClick: menuClick, icon: <span>*</span> },
				]}
			/>,
		);
		fireEvent.click(screen.getByRole("link"));
		fireEvent.click(screen.getByText("Action"));
		expect(menuClick).toHaveBeenCalled();
	});

	it("does not navigate last item without navigateLast", () => {
		render(<BreadcrumbItem index={1} count={2} label="Last" href="#last" />);
		fireEvent.click(screen.getByRole("link"));
		expect(setHash).not.toHaveBeenCalled();
	});

	it("renders description when provided", () => {
		render(
			<BreadcrumbItem
				index={1}
				count={2}
				label="Item"
				href="#i"
				description="Desc"
			/>,
		);
		expect(screen.getByText("Desc")).toBeInTheDocument();
	});

	it("uses rtl separator icon", () => {
		MainStore.useState.mockReturnValue({ direction: "rtl" });
		render(<BreadcrumbItem index={0} count={2} label="Home" href="#home" />);
		expect(screen.getByRole("link")).toBeInTheDocument();
	});

	it("collapses middle items on phone with many crumbs", () => {
		useDeviceType.mockReturnValue("phone");
		const items = Array.from({ length: 7 }, (_, i) => ({
			label: `L${i}`,
			name: `n${i}`,
		}));
		render(
			<BreadcrumbItem
				index={3}
				count={7}
				items={items}
				label="Middle"
				href="#m"
			/>,
		);
		// collapsed middle returns null or MoreHoriz for count-3
		expect(screen.queryByText("Middle")).not.toBeInTheDocument();
	});

	it("shows MoreHoriz ellipsis for near-end collapsed index", () => {
		useDeviceType.mockReturnValue("phone");
		const items = Array.from({ length: 7 }, (_, i) => ({
			label: `L${i}`,
			name: `n${i}`,
		}));
		render(
			<BreadcrumbItem
				index={4}
				count={7}
				items={items}
				label="NearEnd"
				href="#n"
			/>,
		);
		expect(screen.getByLabelText("More items")).toBeInTheDocument();
	});

	it("shows labels on tablet for short breadcrumb trails", () => {
		useDeviceType.mockReturnValue("tablet");
		render(
			<BreadcrumbItem
				index={1}
				count={3}
				label="Middle"
				name="middle"
				href="#middle"
			/>,
		);
		expect(screen.getByText("Middle")).toBeInTheDocument();
	});

	it("collapses middle crumbs on desktop when count is high", () => {
		useDeviceType.mockReturnValue("desktop");
		const items = Array.from({ length: 10 }, (_, i) => ({
			label: `L${i}`,
			name: `n${i}`,
		}));
		const { container } = render(
			<BreadcrumbItem
				index={5}
				count={10}
				items={items}
				label="Hidden"
				href="#hidden"
			/>,
		);
		expect(container).toBeEmptyDOMElement();
	});

	it("renders icon when Icon prop is provided", () => {
		const Icon = () => <span data-testid="crumb-icon">*</span>;
		render(
			<BreadcrumbItem
				index={0}
				count={2}
				label="Home"
				href="#home"
				Icon={Icon}
			/>,
		);
		expect(screen.getByTestId("crumb-icon")).toBeInTheDocument();
	});

	it("closes menu items without onClick handlers safely", () => {
		render(
			<BreadcrumbItem
				index={1}
				count={2}
				label="Last"
				href="#last"
				menuItems={[{ name: "Noop" }]}
			/>,
		);
		fireEvent.click(screen.getByRole("link"));
		fireEvent.click(screen.getByText("Noop"));
		expect(setHash).not.toHaveBeenCalled();
	});

	it("hides root when hideRoot is set", () => {
		const { container } = render(
			<BreadcrumbItem index={0} count={2} label="Root" href="#root" hideRoot />,
		);
		expect(container).toBeEmptyDOMElement();
	});
});

describe("BreadcrumbsWidget Component", () => {
	beforeEach(() => {
		useDeviceType.mockReturnValue("desktop");
		MainStore.useState.mockReturnValue({ direction: "ltr" });
		jest.clearAllMocks();
	});

	it("renders breadcrumbs", () => {
		const items = [
			{ id: "home", name: "Home", url: "home" },
			{ id: "sub", name: "Sub", url: "sub" },
		];
		render(<BreadcrumbsWidget items={items} />);
		expect(screen.getByText("Sub")).toBeInTheDocument();
	});

	it("filters out items with breadcrumbs false", () => {
		const items = [
			{ id: "home", name: "Home", url: "home" },
			{ id: "hidden", name: "Hidden", url: "hidden", breadcrumbs: false },
			{ id: "sub", name: "Sub", url: "sub" },
		];
		render(<BreadcrumbsWidget items={items} />);
		expect(screen.queryByText("Hidden")).not.toBeInTheDocument();
		expect(screen.getByText("Sub")).toBeInTheDocument();
	});

	it("hides library root on desktop when children exist", () => {
		const items = [
			{ id: "home", name: "Home", url: "home" },
			{ id: "library", name: "Library", url: "library", custom: true },
			{ id: "tag", name: "Tag", url: "library/tag" },
		];
		render(<BreadcrumbsWidget items={items} />);
		expect(screen.queryByText("Library")).not.toBeInTheDocument();
		expect(screen.getByText("Tag")).toBeInTheDocument();
	});

	it("keeps library root on phone and hides children", () => {
		useDeviceType.mockReturnValue("phone");
		const items = [
			{ id: "home", name: "Home", url: "home" },
			{ id: "library", name: "Library", url: "library", custom: true },
			{ id: "tag", name: "Tag", url: "library/tag" },
		];
		render(<BreadcrumbsWidget items={items} border bar />);
		expect(screen.getByText("Library")).toBeInTheDocument();
		expect(screen.queryByText("Tag")).not.toBeInTheDocument();
	});

	it("renders sidebar icon and toolbar when bar is set", () => {
		render(
			<BreadcrumbsWidget
				bar
				items={[{ id: "home", name: "Home", url: "home" }]}
			/>,
		);
		expect(screen.getByTestId("sidebar-icon")).toBeInTheDocument();
		expect(screen.getAllByTestId("toolbar").length).toBeGreaterThan(0);
	});

	it("renders dual header toolbars on desktop when bar is set", () => {
		useDeviceType.mockReturnValue("desktop");
		render(
			<BreadcrumbsWidget
				bar
				items={[{ id: "home", name: "Home", url: "home" }]}
			/>,
		);
		expect(screen.getAllByTestId("toolbar")).toHaveLength(2);
	});

	it("filters items without a library custom root match", () => {
		const items = [
			{ id: "home", name: "Home", url: "home" },
			{ id: "library", name: "Library", url: "library" },
			{ id: "article", name: "Article", url: "library/article" },
		];
		render(<BreadcrumbsWidget items={items} />);
		expect(screen.getByText("Article")).toBeInTheDocument();
	});
});
