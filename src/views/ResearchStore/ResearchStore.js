import { Store } from "pullstate";

export const ResearchStore = new Store({
    query: "",
    filterTags: [],
    results: [],
    highlight: [],
    hasSearched: false,
    _loaded: false,
    indexing: false,
    progress: 0,
    status: "",
    indexTimestamp: 0
});
