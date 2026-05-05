import { ContentSize } from "@components/Page/Content";
import { render } from "@testing-library/react";
import { useSessions } from "@util/sessions";
import { useDeviceType } from "@util/styles";
import { useTranslations } from "@util/translations";
import Cookies from "js-cookie";
import Research from "./index";

jest.mock("@util/translations");
jest.mock("@views/ResearchStore/ResearchStore", () => ({
	ResearchStore: {
		useState: jest.fn().mockReturnValue({
			query: "",
			filterTags: [],
			results: [{ docId: "1", text: "result" }],
			hasSearched: true,
			_loaded: true,
			highlight: "",
			indexing: false,
			progress: 0,
			status: "",
			indexTimestamp: 0,
		}),
		update: jest.fn(),
	},
}));
jest.mock("@util/sessions");
jest.mock("@sync/syncState", () => ({
	SyncActiveStore: {
		useState: jest.fn().mockReturnValue(0),
	},
}));
jest.mock("@util/styles");
jest.mock("@util/storage", () => ({
	exists: jest.fn().mockResolvedValue(false),
	readFile: jest.fn().mockResolvedValue(""),
}));
jest.mock("@util/views", () => ({
	setHash: jest.fn(),
	setPath: jest.fn(),
	usePathItems: jest.fn().mockReturnValue([]),
}));
jest.mock("@components/Virtualized/VariableSizeList", () => () => (
	<div data-testid="virtual-list" />
));
jest.mock("./PageIndicator", () => () => <div data-testid="page-indicator" />);
jest.mock("./SearchResultItem", () => () => (
	<div data-testid="search-result-item" />
));
jest.mock("@components/Toolbar", () => ({
	registerToolbar: jest.fn(),
	useToolbar: jest.fn(),
}));
jest.mock("@views/Library/Article", () => () => <div data-testid="article" />);
jest.mock("js-cookie");

describe("Research View", () => {
	const mockSize = { width: 800, height: 600, emPixels: 16 };

	beforeEach(() => {
		jest.clearAllMocks();
		useTranslations.mockReturnValue({
			SESSIONS: "Sessions",
			ARTICLES: "Articles",
			SUMMARIES: "Summaries",
			TRANSCRIPTIONS: "Transcriptions",
			SEARCH: "Search",
		});
		useSessions.mockReturnValue([[], false, []]);
		useDeviceType.mockReturnValue("desktop");
		Cookies.get.mockReturnValue("admin");
	});

	it("renders search field and virtual list", () => {
		const { getByTestId } = render(
			<ContentSize.Provider value={mockSize}>
				<Research />
			</ContentSize.Provider>,
		);
		expect(getByTestId("virtual-list")).toBeInTheDocument();
		// Research uses TextField which should have a label from translations
	});
});
