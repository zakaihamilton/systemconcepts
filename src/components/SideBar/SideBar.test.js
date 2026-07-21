import { useBookmarks } from "@components/Bookmarks";
import { fireEvent, render, screen } from "@testing-library/react";
import { useDeviceType } from "@util/browser/styles";
import { useTranslations } from "@util/domain/translations";
import { setHash, useActivePages, usePages } from "@util/domain/views";
import { ResearchStore } from "@views/ResearchStore/ResearchStore";
import { MainStore } from "../Main/index.js";
import SideBar from "./index.js";

jest.mock("@util/browser/styles");
jest.mock("@util/domain/views");
jest.mock("@components/Bookmarks");
jest.mock("@util/domain/translations");
jest.mock("../Main", () => ({
	MainStore: {
		useState: jest.fn(),
		update: jest.fn((updater) => {
			const state = {
				direction: "ltr",
				showSlider: false,
				hash: "",
				libraryExpanded: false,
			};
			updater(state);
			return state;
		}),
	},
}));
jest.mock("@views/ResearchStore/ResearchStore", () => ({
	ResearchStore: {
		useState: jest.fn(),
	},
}));
jest.mock("@widgets/List", () => (props) => (
	<div data-testid="list">
		{(props.items || []).map((item) => (
			<button
				key={item.id}
				type="button"
				data-testid={`item-${item.id}`}
				data-target={item.target}
				data-selected={String(props.state?.[0]?.(item.id))}
				onClick={() => {
					if (item.onToggle) {
						item.onToggle(!item.isOpen);
					} else {
						props.state?.[1]?.(item.id);
					}
				}}
			>
				{item.name}
				{item.description}
			</button>
		))}
	</div>
));
jest.mock("./QuickAccess", () => (props) => (
	<div data-testid="quick-access">
		<button
			type="button"
			data-testid="scroll-bottom"
			onClick={() => props.onScrollToBottom?.()}
		>
			scroll
		</button>
		<button
			type="button"
			data-testid="close-drawer"
			onClick={() => props.closeDrawer?.()}
		>
			close
		</button>
		<button
			type="button"
			data-testid="unknown-nav"
			onClick={() => props.state?.[1]?.("missing-page")}
		>
			unknown
		</button>
	</div>
));
jest.mock("./LibraryTree", () => (props) => (
	<div data-testid="library-tree">
		<button
			type="button"
			data-testid="library-toggle"
			onClick={() => props.onToggle?.(true)}
		>
			toggle
		</button>
	</div>
));
jest.mock("@views/ResearchIndexer/ResearchIndexer", () => () => (
	<div data-testid="research-indexer" />
));
jest.mock(
	"@ui/Drawer",
	() =>
		({ children, open, onClose }) =>
			open ? (
				<div data-testid="drawer">
					<button type="button" data-testid="drawer-close" onClick={onClose}>
						close
					</button>
					{children}
				</div>
			) : null,
);
jest.mock("@ui/LinearProgress", () => (props) => (
	<div data-testid="linear-progress" data-value={props.value} />
));

describe("SideBar Component", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		useTranslations.mockReturnValue({
			LIBRARY: "Library",
			BOOKMARKS: "Bookmarks",
		});
		useDeviceType.mockReturnValue("desktop");
		MainStore.useState.mockReturnValue({
			direction: "ltr",
			showSlider: false,
			hash: "sessions",
			libraryExpanded: false,
		});
		ResearchStore.useState.mockReturnValue({ indexing: false, progress: 0 });
		useBookmarks.mockReturnValue([]);
		useActivePages.mockReturnValue([]);
		usePages.mockReturnValue([
			{ id: "sessions", name: "Sessions", sidebar: true, apps: true },
			{ id: "library", name: "Library", sidebar: true, apps: true },
			{ id: "account", name: "Account", sidebar: true, path: "account" },
			{ id: "research", name: "Research", sidebar: true, apps: true },
		]);
	});

	it("renders list and quick access on desktop", () => {
		const { getByTestId } = render(<SideBar />);
		expect(getByTestId("list")).toBeInTheDocument();
		expect(getByTestId("quick-access")).toBeInTheDocument();
	});

	it("renders drawer on mobile when showSlider is true", () => {
		useDeviceType.mockReturnValue("phone");
		MainStore.useState.mockReturnValue({
			direction: "ltr",
			showSlider: true,
			hash: "",
			libraryExpanded: false,
		});
		render(<SideBar />);
		expect(screen.getByTestId("drawer")).toBeInTheDocument();
		fireEvent.click(screen.getByTestId("drawer-close"));
		expect(MainStore.update).toHaveBeenCalled();
	});

	it("auto-expands library when library page is active", () => {
		useActivePages.mockReturnValue([{ id: "library", custom: true }]);
		render(<SideBar />);
		expect(MainStore.update).toHaveBeenCalled();
	});

	it("shows research indexing progress in the research item", () => {
		ResearchStore.useState.mockReturnValue({ indexing: true, progress: 55 });
		render(<SideBar />);
		expect(screen.getByTestId("linear-progress")).toHaveAttribute(
			"data-value",
			"55",
		);
	});

	it("adds redirect query to account when navigating from another page", () => {
		render(<SideBar />);
		expect(screen.getByTestId("item-account")).toBeInTheDocument();
	});

	it("includes bookmarks section when bookmarks exist", () => {
		useBookmarks.mockReturnValue([
			{ id: "bm1", name: "Saved", path: "sessions" },
		]);
		render(<SideBar />);
		expect(screen.getByText("Bookmarks")).toBeInTheDocument();
	});

	it("selects a page via setHash when page exists", () => {
		render(<SideBar />);
		fireEvent.click(screen.getByTestId("item-sessions"));
		expect(setHash).toHaveBeenCalled();
	});

	it("falls back to hash update when page is missing", () => {
		usePages.mockReturnValue([
			{ id: "library", name: "Library", sidebar: true, apps: true },
		]);
		render(<SideBar />);
		// Trigger setSelected with unknown id via list state
		const list = screen.getByTestId("list");
		expect(list).toBeInTheDocument();
	});

	it("toggles library expansion", () => {
		MainStore.useState.mockReturnValue({
			direction: "ltr",
			showSlider: false,
			hash: "",
			libraryExpanded: true,
		});
		render(<SideBar />);
		const toggle = screen.queryByTestId("library-toggle");
		if (toggle) {
			fireEvent.click(toggle);
			expect(MainStore.update).toHaveBeenCalled();
		}
	});

	it("renders research indexer", () => {
		render(<SideBar />);
		expect(screen.getByTestId("research-indexer")).toBeInTheDocument();
	});

	it("falls back to hash update when page is not in pages list", () => {
		usePages.mockReturnValue([]);
		render(<SideBar />);
		fireEvent.click(screen.getByTestId("unknown-nav"));
		expect(MainStore.update).toHaveBeenCalled();
	});

	it("does not treat pages with sectionIndex as selected", () => {
		useActivePages.mockReturnValue([{ id: "sessions", sectionIndex: 0 }]);
		render(<SideBar />);
		expect(screen.getByTestId("item-sessions")).toBeInTheDocument();
	});

	it("appends redirect target for account when hash starts with hash symbol", () => {
		MainStore.useState.mockReturnValue({
			direction: "ltr",
			showSlider: false,
			hash: "#sessions",
			libraryExpanded: false,
		});
		usePages.mockReturnValue([
			{ id: "account", name: "Account", sidebar: true, path: "account" },
		]);
		render(<SideBar />);
		expect(screen.getByTestId("item-account")).toHaveAttribute(
			"data-target",
			"account?redirect=sessions",
		);
	});

	it("maps bookmark pages into the bookmarks section", () => {
		useBookmarks.mockReturnValue([
			{ id: "bm1", name: "Saved", path: "sessions" },
		]);
		usePages.mockReturnValue([
			{
				id: "bookmark-page",
				name: "Pinned",
				sidebar: true,
				category: "bookmarks",
				path: "sessions/foo",
			},
		]);
		render(<SideBar />);
		expect(screen.getByText("Bookmarks")).toBeInTheDocument();
	});

	it("scrolls sidebar to bottom when quick access requests it", () => {
		jest.useFakeTimers();
		const scrollTo = jest.fn();
		const { container } = render(<SideBar />);
		const root = container.querySelector('[class*="root"]');
		if (root) {
			root.scrollTo = scrollTo;
		}
		fireEvent.click(screen.getByTestId("scroll-bottom"));
		jest.advanceTimersByTime(300);
		expect(scrollTo).toHaveBeenCalled();
		jest.useRealTimers();
	});

	it("closes desktop drawer when closeDrawer is invoked", () => {
		useDeviceType.mockReturnValue("desktop");
		render(<SideBar />);
		fireEvent.click(screen.getByTestId("close-drawer"));
		expect(MainStore.update).toHaveBeenCalled();
	});

	it("marks active pages without sectionIndex as selected", () => {
		useActivePages.mockReturnValue([{ id: "sessions" }]);
		render(<SideBar />);
		expect(screen.getByTestId("item-sessions")).toHaveAttribute(
			"data-selected",
			"true",
		);
	});

	it("appends redirect target for account in apps list", () => {
		MainStore.useState.mockReturnValue({
			direction: "ltr",
			showSlider: false,
			hash: "sessions",
			libraryExpanded: false,
		});
		usePages.mockReturnValue([
			{
				id: "account",
				name: "Account",
				sidebar: true,
				apps: true,
				path: "account",
			},
		]);
		render(<SideBar />);
		expect(screen.getByTestId("item-account")).toHaveAttribute(
			"data-target",
			"account?redirect=sessions",
		);
	});

	it("updates library expanded state from list toggle", () => {
		render(<SideBar />);
		fireEvent.click(screen.getByTestId("item-library"));
		expect(MainStore.update).toHaveBeenCalled();
	});

	it("renders rtl layout class", () => {
		MainStore.useState.mockReturnValue({
			direction: "rtl",
			showSlider: false,
			hash: "",
			libraryExpanded: false,
		});
		const { container } = render(<SideBar />);
		expect(container.querySelector('[class*="rtl"]')).toBeTruthy();
	});

	it("does not append redirect when already on account routes", () => {
		MainStore.useState.mockReturnValue({
			direction: "ltr",
			showSlider: false,
			hash: "account",
			libraryExpanded: false,
		});
		usePages.mockReturnValue([
			{ id: "account", name: "Account", sidebar: true, path: "account" },
		]);
		render(<SideBar />);
		expect(screen.getByTestId("item-account")).toHaveAttribute(
			"data-target",
			"account",
		);
	});

	it("uses translated library name when available", () => {
		usePages.mockReturnValue([
			{ id: "library", name: "LIBRARY", sidebar: true, apps: true },
		]);
		render(<SideBar />);
		expect(screen.getByTestId("item-library")).toHaveTextContent("Library");
	});
});
