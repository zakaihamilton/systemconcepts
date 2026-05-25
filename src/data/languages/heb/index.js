import common from "./common";
import settings from "./settings";
import storage from "./storage";
import api from "./api";
import auth from "./auth";
import content from "./content";
import sync from "./sync";
import sessions from "./sessions";
import media from "./media";
import articles from "./articles";
import search from "./search";

export default {
	id: "heb",
	name: "עברית",
	direction: "rtl",
	code: "he",
	locale: "he-IL",
	translations: [
		...common,
		...settings,
		...storage,
		...api,
		...auth,
		...content,
		...sync,
		...sessions,
		...media,
		...articles,
		...search,
	],
};
