import { SyncActiveStore, UpdateSessionsStore } from "@sync/syncState";
import storage from "@util/storage/storage";
import {
	loadDurations,
	loadSummaries,
	loadTags,
	loadTranscriptions,
} from "./metadata";
import { fetchSessionMetadata } from "./sessionMetadataClient";
import { getListing, updateYearSync } from "./utils";

jest.mock("@sync/bundle", () => ({
	writeCompressedFile: jest.fn(),
}));
jest.mock("@sync/hash", () => ({
	getFileInfo: jest.fn(),
}));
jest.mock("@sync/manifest", () => ({
	updateManifestEntry: jest.fn(),
}));
jest.mock("@sync/sync", () => ({
	addSyncLog: jest.fn(),
}));
jest.mock("@util/api/logger", () => ({
	logger: {
		debug: jest.fn(),
		error: jest.fn(),
		info: jest.fn(),
		warn: jest.fn(),
	},
}));
jest.mock("@util/storage/storage", () =>
	require("./updateGroupMockFactories").storageMockFactory(),
);
jest.mock("./cleanup", () => ({
	cleanupBundledGroup: jest.fn(),
	cleanupMergedGroup: jest.fn(),
}));
jest.mock("./metadata", () => ({
	loadDurations: jest.fn(),
	loadSummaries: jest.fn(),
	loadTags: jest.fn(),
	loadTranscriptions: jest.fn(),
}));
jest.mock("./sessionMetadataClient", () => ({
	fetchSessionMetadata: jest.fn(),
}));
jest.mock("./utils", () => ({
	getListing: jest.fn(),
	updateBundleFile: jest.fn(),
	updateYearSync: jest.fn(),
	yieldToMain: jest.fn(() => Promise.resolve()),
}));

export function file(name: any, path: any) {
	return { id: path, name, type: "file" as const, path };
}

export function setupUpdateGroupTest() {
	jest.clearAllMocks();
	UpdateSessionsStore.update((s) => {
		s.status = [];
	});
	SyncActiveStore.update((s) => {
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
