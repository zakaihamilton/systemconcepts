import { Store } from "pullstate";

export const LibraryStore = new Store({
    tags: [],
    lastViewedArticle: null,
    scrollToPath: null,
    expandedNodes: []
});
