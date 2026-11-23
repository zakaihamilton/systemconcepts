type ResearchSetupOptions = {
	cookies: typeof import("js-cookie").default;
	resetAdditionalState?: () => void;
};

const mockResearchTestState: {
	researchState: any;
	libraryState: any;
	libraryUpdateCounter: number;
} = {
	researchState: undefined,
	libraryState: undefined,
	libraryUpdateCounter: 0,
};

jest.mock("@util/domain/translations");
jest.mock("@views/ResearchStore/ResearchStore", () => ({
	ResearchStore: {
		useState: jest.fn(() => mockResearchTestState.researchState),
		update: jest.fn((updater) => updater(mockResearchTestState.researchState)),
	},
}));
jest.mock("@util/domain/sessions");
jest.mock("@util/data/searchIndexBinary", () => ({
	decodeBinaryIndex: jest.fn(),
}));
jest.mock("@util/domain/loadParagraphs", () => ({
	loadParagraphsForFile: jest.fn(),
}));
jest.mock("@views/Library/Store", () => ({
	LibraryStore: {
		getRawState: jest.fn(() => mockResearchTestState.libraryState),
		update: jest.fn((updates) => updates(mockResearchTestState.libraryState)),
	},
}));
jest.mock("@sync/syncState", () => ({
	SyncActiveStore: {
		useState: jest.fn((selector) => {
			const state = {
				libraryUpdateCounter: mockResearchTestState.libraryUpdateCounter,
			};
			return selector
				? selector(state)
				: mockResearchTestState.libraryUpdateCounter;
		}),
	},
}));
jest.mock("@util/browser/styles");
jest.mock("@util/storage/storage", () => ({
	exists: jest.fn().mockResolvedValue(false),
	readFile: jest.fn().mockResolvedValue(""),
	deleteFile: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("@util/domain/views", () => ({
	setHash: jest.fn(),
	setPath: jest.fn(),
	usePathItems: jest.fn().mockReturnValue([]),
}));
jest.mock("./runResearchSearch", () => ({
	runResearchSearch: jest.fn(),
}));
jest.mock("@components/Toolbar", () => ({
	registerToolbar: jest.fn(),
	useToolbar: jest.fn(),
}));
jest.mock(
	"@views/Library/Article",
	() => () =>
		require("react").createElement("div", { "data-testid": "article" }),
);
jest.mock("js-cookie");
jest.mock("@util/api/logger", () => ({
	logger: { error: jest.fn(), debug: jest.fn(), warn: jest.fn() },
}));

export function setResearchTestLibraryUpdateCounter(value: number) {
	mockResearchTestState.libraryUpdateCounter = value;
}

function createResearchState() {
	return {
		query: "",
		filterTags: [],
		source: "all",
		results: [{ docId: "1", text: "result" }],
		hasSearched: true,
		_loaded: true,
		highlight: [],
		indexing: false,
		progress: 0,
		status: "",
		indexTimestamp: 0,
	};
}

function createResearchTranslations() {
	return {
		RESEARCH: "Research",
		SESSIONS: "Sessions",
		ARTICLES: "Articles",
		SUMMARIES: "Summaries",
		INDEXING: "Indexing...",
		SEARCH: "Search",
		SEARCH_ARTICLES: "Search...",
		ALL: "All",
		FILTERS: "Filters",
		SEARCH_FILTERS: "Search filters...",
		CLOSE: "Close",
		DONE: "Done",
		CLEAR_ALL: "Clear all",
		CLEAR: "Clear search",
		RESEARCH_HELP: "Search your library",
		SEARCH_HINT: "Use quotes for a phrase",
		SHOW_SEARCH: "Show Search",
		HIDE_SEARCH: "Hide Search",
		RESEARCH_START: "Find ideas",
		RESEARCH_START_HELP: "Search by a word",
		RESEARCH_PREPARING: "Preparing Research",
		RESEARCH_INDEX_HELP: "Index is preparing",
		SUGGESTION_TITLE: "Title",
		SUGGESTION_FILTER: "Filter",
		SUGGESTION_TERM: "Term",
		ARTICLE: "Article",
		RESULTS_LIST: "Results list",
		MATCH: "matches",
	};
}

export function setupResearchViewTest(options: ResearchSetupOptions) {
	const { useDeviceType } = jest.requireMock("@util/browser/styles");
	const { useSessions } = jest.requireMock("@util/domain/sessions");
	const { useTranslations } = jest.requireMock("@util/domain/translations");
	jest.clearAllMocks();
	options.resetAdditionalState?.();
	const { runResearchSearch } = require("./runResearchSearch");
	asMock(runResearchSearch).mockImplementation(
		jest.requireActual("./runResearchSearch").runResearchSearch,
	);
	global.ResizeObserver = jest.fn().mockImplementation(() => ({
		observe: jest.fn(),
		disconnect: jest.fn(),
		unobserve: jest.fn(),
	}));
	const researchState = createResearchState();
	const libraryState = { tags: [] };
	mockResearchTestState.researchState = researchState;
	mockResearchTestState.libraryState = libraryState;
	mockResearchTestState.libraryUpdateCounter = 0;
	asMock(useTranslations).mockReturnValue(createResearchTranslations());
	asMock(useSessions).mockReturnValue([
		[{ name: "Grace in practice", group: "ai", year: "2024" }],
		false,
		[],
	]);
	asMock(useDeviceType).mockReturnValue("desktop");
	asMock(options.cookies.get).mockReturnValue("admin");
	return { researchState, libraryState };
}
