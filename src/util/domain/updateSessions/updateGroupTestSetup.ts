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
jest.mock("@util/storage/storage", () => ({
	createFolderPath: jest.fn(),
	deleteFile: jest.fn(),
	exists: jest.fn(),
	readFile: jest.fn(),
	writeFile: jest.fn(),
}));
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

function defaultMetadataFiles() {
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

export function yearListingFiles(year: string, filenames: string[]) {
	return filenames.map((name) => file(name, `wasabi/test/${year}/${name}`));
}

type MetadataListingOptions = {
	extensions?: string[];
	size?: number;
	mtimeMs?: number;
};

export function metadataListingFiles(
	year: string,
	{
		extensions = ["tags", "duration", "md", "zip"],
		size = 100,
		mtimeMs = 1,
	}: MetadataListingOptions = {},
) {
	return extensions.map((extension) => ({
		name: `${year}.${extension}`,
		size,
		mtimeMs,
	}));
}

export function fingerprintMetadataFiles(
	files: Array<{ name: string; size: number; mtimeMs: number }>,
) {
	return files.map(({ name, size, mtimeMs }) => ({
		name,
		type: "",
		size,
		mtimeMs,
	}));
}

export function emptyMetadataFingerprint() {
	return [null, null, null, null];
}

type TestListingItem = {
	id?: string;
	name?: string;
	path?: string;
	type?: string;
	size?: number;
	mtimeMs?: number;
	stat?: Record<string, unknown>;
	[key: string]: unknown;
};

type ListingResponse = TestListingItem[] | null | Error;

export function mockListingResponses(
	responses: Record<string, ListingResponse>,
) {
	asMock(getListing).mockImplementation(async (path: string) => {
		const response = responses[path];
		if (response instanceof Error) throw response;
		return response ?? [];
	});
}

export function mockYearListing(
	year: string,
	items: TestListingItem[],
	metadataItems?: TestListingItem[],
) {
	const responses: Record<string, ListingResponse> = {
		"wasabi/test": [{ name: year, type: "dir", path: `wasabi/test/${year}` }],
		[`wasabi/test/${year}`]: items,
	};
	if (metadataItems) responses["/aws/sessions/test"] = metadataItems;
	mockListingResponses(responses);
}

export function cachedYearSession(
	id: string,
	year: string,
	overrides: Record<string, unknown> = {},
) {
	return { id, name: id, group: "test", year, ...overrides };
}

type YearCacheFixtureOptions = {
	cache?: unknown;
	group?: string;
	localPath?: string;
};

export function mockYearCacheAndSessions(
	year: string,
	sessions: unknown,
	options: YearCacheFixtureOptions = {},
) {
	const group = options.group ?? "test";
	const localPath = options.localPath ?? `/local/sync/${group}/${year}.json`;
	asMock(storage.exists).mockImplementation(async (path: string) =>
		path.endsWith(localPath),
	);
	asMock(storage.readFile).mockImplementation(async (path: string) => {
		if (path.endsWith(localPath)) {
			return JSON.stringify({ sessions });
		}
		if (path.includes(`.group-update-cache/${group}/${year}.json`)) {
			return options.cache === undefined
				? ""
				: (JSON.stringify(options.cache) ?? "");
		}
		return "";
	});
	return localPath;
}

type YearMetadata = Awaited<ReturnType<typeof fetchSessionMetadata>>;

export function yearMetadata(
	overrides: Partial<YearMetadata> = {},
): YearMetadata {
	return {
		items: [],
		tags: {},
		durations: {},
		summaries: {},
		transcriptions: {},
		...overrides,
	};
}

export function sessionMetadataFiles(
	year: string,
	sessionName: string,
	extensions: string[],
) {
	return extensions.map((extension) => {
		const name = `${sessionName}.${extension}`;
		return file(name, `/aws/sessions/test/${year}/${name}`);
	});
}

export function emptyYearMetadata() {
	return yearMetadata();
}

export function mockCachedYearSession(
	year: string,
	id: string,
	fingerprint: string,
	metadataFingerprint: unknown,
	sessionOverrides: Record<string, unknown> = {},
) {
	return mockYearCacheAndSessions(
		year,
		[cachedYearSession(id, year, sessionOverrides)],
		{
			cache: {
				fingerprint,
				metadataFingerprint: JSON.stringify(metadataFingerprint),
				metadata: emptyYearMetadata(),
			},
		},
	);
}

type UpdateGroupTestSetupOptions = {
	readFile?: typeof storage.readFile;
	sessionMetadata?: Awaited<ReturnType<typeof fetchSessionMetadata>>;
	listing?: typeof getListing;
};

export function setupUpdateGroupTest(
	options: UpdateGroupTestSetupOptions = {},
) {
	jest.clearAllMocks();
	UpdateSessionsStore.update((s) => {
		s.status = [];
	});
	SyncActiveStore.update((s) => {
		s.needsSessionReload = false;
	});

	asMock(storage.exists).mockResolvedValue(false);
	asMock(storage.readFile).mockImplementation(
		options.readFile ??
			(async (path: string) => {
				if (path.endsWith(".duration")) return "123";
				if (path.endsWith(".md")) return "Summary from DigitalOcean";
				if (path.endsWith(".tags")) return JSON.stringify(["ai", "sync"]);
				return "";
			}),
	);
	asMock(loadTags).mockResolvedValue({});
	asMock(loadDurations).mockResolvedValue({});
	asMock(loadSummaries).mockResolvedValue({});
	asMock(loadTranscriptions).mockResolvedValue({});
	asMock(fetchSessionMetadata).mockResolvedValue(
		options.sessionMetadata ?? {
			items: defaultMetadataFiles(),
			tags: {},
			durations: {},
			summaries: {},
			transcriptions: {},
		},
	);

	asMock(getListing).mockImplementation(
		options.listing ??
			(async (path: string) => {
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
					return defaultMetadataFiles();
				}
				return [];
			}),
	);

	asMock(updateYearSync).mockResolvedValue({
		counter: 0,
		newCount: 0,
		newSessions: [],
	});
}
