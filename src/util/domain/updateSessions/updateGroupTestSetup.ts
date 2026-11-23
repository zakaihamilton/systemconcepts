export function file(name: any, path: any) {
	return { id: path, name, type: "file" as const, path };
}

export function setupUpdateGroupTest() {
	const { SyncActiveStore, UpdateSessionsStore } = require("@sync/syncState");
	const storage = require("@util/storage/storage");
	const {
		loadDurations,
		loadSummaries,
		loadTags,
		loadTranscriptions,
	} = require("./metadata");
	const { fetchSessionMetadata } = require("./sessionMetadataClient");
	const { getListing, updateYearSync } = require("./utils");
	jest.clearAllMocks();
	UpdateSessionsStore.update((s: any) => {
		s.status = [];
	});
	SyncActiveStore.update((s: any) => {
		s.needsSessionReload = false;
	});

	asMock(storage.exists).mockResolvedValue(false);
	asMock(storage.readFile).mockImplementation(async (path: any) => {
		if (path.endsWith(".duration")) return "123";
		if (path.endsWith(".md")) return "Summary from DigitalOcean";
		if (path.endsWith(".tags")) return JSON.stringify(["ai", "sync"]);
		return "";
	});
	asMock(loadTags).mockResolvedValue({});
	asMock(loadDurations).mockResolvedValue({});
	asMock(loadSummaries).mockResolvedValue({});
	asMock(loadTranscriptions).mockResolvedValue({});
	asMock(fetchSessionMetadata).mockResolvedValue({
		items: [
			file(
				"2024-05-05 Test Session.duration",
				"/aws/sessions/test/2024/2024-05-05 Test Session.duration",
			),
			file(
				"2024-05-05 Test Session.md",
				"/aws/sessions/test/2024/2024-05-05 Test Session.md",
			),
			file(
				"2024-05-05 Test Session.txt",
				"/aws/sessions/test/2024/2024-05-05 Test Session.txt",
			),
			file(
				"2024-05-05 Test Session.en.vtt",
				"/aws/sessions/test/2024/2024-05-05 Test Session.en.vtt",
			),
			file(
				"2024-05-05 Test Session.png",
				"/aws/sessions/test/2024/2024-05-05 Test Session.png",
			),
			file(
				"2024-05-06 Metadata Only.txt",
				"/aws/sessions/test/2024/2024-05-06 Metadata Only.txt",
			),
		],
		tags: {},
		durations: {},
		summaries: {},
		transcriptions: {},
	});

	asMock(getListing).mockImplementation(async (path: any) => {
		if (path === "wasabi/test") {
			return [{ name: "2024", type: "dir", path: "wasabi/test/2024" }];
		}
		if (path === "wasabi/test/2024") {
			return [
				file(
					"2024-05-05 Test Session.mp4",
					"wasabi/test/2024/2024-05-05 Test Session.mp4",
				),
				file(
					"2024-05-05 Test Session.jpg",
					"wasabi/test/2024/2024-05-05 Test Session.jpg",
				),
			];
		}
		if (path === "/aws/sessions/test/2024") {
			return [
				file(
					"2024-05-05 Test Session.duration",
					"/aws/sessions/test/2024/2024-05-05 Test Session.duration",
				),
				file(
					"2024-05-05 Test Session.md",
					"/aws/sessions/test/2024/2024-05-05 Test Session.md",
				),
				file(
					"2024-05-05 Test Session.txt",
					"/aws/sessions/test/2024/2024-05-05 Test Session.txt",
				),
				file(
					"2024-05-05 Test Session.en.vtt",
					"/aws/sessions/test/2024/2024-05-05 Test Session.en.vtt",
				),
				file(
					"2024-05-05 Test Session.png",
					"/aws/sessions/test/2024/2024-05-05 Test Session.png",
				),
				file(
					"2024-05-06 Metadata Only.txt",
					"/aws/sessions/test/2024/2024-05-06 Metadata Only.txt",
				),
			];
		}
		return [];
	});

	asMock(updateYearSync).mockResolvedValue({
		counter: 0,
		newCount: 0,
		newSessions: [],
	});
}
