import { createStore } from "@util/browser/store";

export const LibraryStore = createStore({
	tags: [],
	lastViewedArticle: null,
	scrollToPath: null,
	scrollToParagraph: null,
	expandedNodes: [],
	selectPath: null,
	selectedId: null,
	clickedId: null,
});
