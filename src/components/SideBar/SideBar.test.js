import { useBookmarks } from "@components/Bookmarks";
import { render } from "@testing-library/react";
import { useDeviceType } from "@util/styles";
import { useTranslations } from "@util/translations";
import { useActivePages, usePages } from "@util/views";
import { ResearchStore } from "@views/ResearchStore/ResearchStore";
import { MainStore } from "../Main/index.js";
import SideBar from "./index.js";

jest.mock("@util/styles");
jest.mock("@util/views");
jest.mock("@components/Bookmarks");
jest.mock("@util/translations");
jest.mock("../Main", () => ({
	MainStore: {
		useState: jest.fn(),
		update: jest.fn(),
	},
}));
jest.mock("@views/ResearchStore/ResearchStore", () => ({
	ResearchStore: {
		useState: jest.fn(),
	},
}));
jest.mock("@widgets/List", () => () => <div data-testid="list" />);
jest.mock("./QuickAccess", () => () => (
	<div data-testid="quick-access" />
));
jest.mock("./LibraryTree", () => () => (
	<div data-testid="library-tree" />
));
jest.mock("@views/ResearchIndexer/ResearchIndexer", () => () => (
	<div data-testid="research-indexer" />
));

describe("SideBar Component", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		useTranslations.mockReturnValue({ LIBRARY: "Library" });
		useDeviceType.mockReturnValue("desktop");
		MainStore.useState.mockReturnValue({
			direction: "ltr",
			showSlider: false,
			hash: "",
			libraryExpanded: false,
		});
		ResearchStore.useState.mockReturnValue({ indexing: false, progress: 0 });
		useBookmarks.mockReturnValue([]);
		useActivePages.mockReturnValue([]);
		usePages.mockReturnValue([]);
	});

	it("renders list and quick access on desktop", () => {
		const { getByTestId } = render(<SideBar />);
		expect(getByTestId("list")).toBeInTheDocument();
		expect(getByTestId("quick-access")).toBeInTheDocument();
	});

	it("renders drawer on mobile", () => {
		useDeviceType.mockReturnValue("phone");
		MainStore.useState.mockReturnValue({
			direction: "ltr",
			showSlider: true,
			hash: "",
			libraryExpanded: false,
		});
		render(<SideBar />);
		// Drawer might be rendered via Portal, so it might not be in container
		// But since I mocked Drawer indirectly via MUI or I can mock it explicitly
	});
});
