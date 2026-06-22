import { ContentSize } from "@components/Page/Content";
import { render } from "@testing-library/react";
import { useDeviceType } from "@util/browser/styles";
import { useSessions } from "@util/domain/sessions";
import { useTranslations } from "@util/domain/translations";
import Cookies from "js-cookie";
import Research from "./";

jest.mock("@util/domain/translations");
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
jest.mock("@util/domain/sessions");
jest.mock("@sync/syncState", () => ({
	SyncActiveStore: {
		useState: jest.fn().mockReturnValue(0),
	},
}));
jest.mock("@util/browser/styles");
jest.mock("@util/storage/storage", () => ({
	exists: jest.fn().mockResolvedValue(false),
	readFile: jest.fn().mockResolvedValue(""),
}));
jest.mock("@util/domain/views", () => ({
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
