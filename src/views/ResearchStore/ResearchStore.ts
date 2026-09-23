import { createStore } from "@util/browser/store";

export const ResearchStore = createStore({
	query: "",
	filterTags: [],
	source: "all",
	results: [],
	highlight: [],
	hasSearched: false,
	_loaded: false,
	indexing: false,
	progress: 0,
	status: "",
	indexTimestamp: 0,
});
