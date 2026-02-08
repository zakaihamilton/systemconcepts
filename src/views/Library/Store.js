import { Store } from "pullstate";

export const LibraryStore = new Store({
    tags: [],
    lastViewedArticle: null,
    scrollToPath: null,
    scrollToParagraph: null,
    expandedNodes: [],
    selectPath: null,
    selectedId: null,
    clickedId: null
});
