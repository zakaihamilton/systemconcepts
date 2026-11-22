import { createStore } from "@util/browser/store";

export const SessionsStore = createStore({
	sessions: null,
	groups: [],
	groupFilter: [],
	typeFilter: [],
	yearFilter: [],
	busy: false,
	counter: 0,
	syncCounter: 0,
	groupsHash: "",
	showFilterDialog: false,
	filterBarManuallyEnabled: false,
	order: "asc",
	orderBy: "date",
	viewMode: "list",
	scrollOffset: 0,
	expandedTreeGroups: [],
});
