type ResearchSetupOptions = {
	setResearchState(state: unknown): void;
	setLibraryState(state: unknown): void;
	resetAdditionalState?: () => void;
	useTranslations: typeof import("@util/domain/translations").useTranslations;
	useSessions: typeof import("@util/domain/sessions").useSessions;
	useDeviceType: typeof import("@util/browser/styles").useDeviceType;
	cookies: typeof import("js-cookie").default;
};

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
	options.setResearchState(createResearchState());
	options.setLibraryState({ tags: [] });
	asMock(options.useTranslations).mockReturnValue(createResearchTranslations());
	asMock(options.useSessions).mockReturnValue([
		[{ name: "Grace in practice", group: "ai", year: "2024" }],
		false,
		[],
	]);
	asMock(options.useDeviceType).mockReturnValue("desktop");
	asMock(options.cookies.get).mockReturnValue("admin");
}
