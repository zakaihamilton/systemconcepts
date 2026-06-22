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
	id: "pt-br",
	name: "Português Brasil",
	direction: "ltr",
	code: "pt-br",
	locale: "pt-BR",
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
