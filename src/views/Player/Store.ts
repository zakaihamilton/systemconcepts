import { createStore } from "@util/browser/store";

export const PlayerStore = createStore({
	path: "",
	mediaPath: "",
	downloadUrl: "",
	subtitles: "",
	transcriptionUrl: "",
	showSubtitles: true,
	showDetails: true,
	showSpeed: false,
	hash: "",
	player: null,
	session: null,
});
