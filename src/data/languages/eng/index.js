import api from "./api";
import articles from "./articles";
import auth from "./auth";
import common from "./common";
import content from "./content";
import media from "./media";
import search from "./search";
import sessions from "./sessions";
import settings from "./settings";
import storage from "./storage";
import sync from "./sync";

export default {
	id: "eng",
	name: "English",
	direction: "ltr",
	code: "en",
	locale: "en-US",
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
