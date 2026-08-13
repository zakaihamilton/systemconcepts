import { Store } from "pullstate";

export const PlayerStore = new Store({
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
