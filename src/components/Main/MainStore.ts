import { createStore } from "@util/browser/store";

export const MainStoreDefaults = {
	fontSize: "16",
	direction: "ltr",
	language: "auto",
	showSideBar: true,
	showDrawer: false,
	speedToolbar: "top",
	showLibrarySideBar: true,
	libraryExpanded: false,
};

// Persist UI prefs only. The URL hash is the source of truth for navigation —
// restoring a stale hash from localStorage can clobber deep links like
// #library/id/<articleId> on startup.
export const MAIN_STORE_PERSISTED_FIELDS = [
	"fontSize",
	"direction",
	"language",
	"showSideBar",
	"showDrawer",
	"speedToolbar",
	"showLibrarySideBar",
	"libraryExpanded",
];

export const MainStore = createStore(MainStoreDefaults);
