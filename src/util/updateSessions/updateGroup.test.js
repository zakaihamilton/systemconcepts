import { readBinary } from "@util/binary";
import { blobToBase64, shrinkImage } from "@util/image";
import storage from "@util/storage";
import {
	loadDurations,
	loadSummaries,
	loadTags,
	loadTranscriptions,
} from "./metadata";
import { updateGroupProcess } from "./updateGroup";
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
jest.mock("@util/binary", () => ({
	readBinary: jest.fn(),
}));
jest.mock("@util/image", () => ({
	blobToBase64: jest.fn(),
	shrinkImage: jest.fn(),
}));
jest.mock("@util/storage", () => ({
	deleteFile: jest.fn(),
	exists: jest.fn(),
	readFile: jest.fn(),
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
jest.mock("./utils", () => ({
	getListing: jest.fn(),
	updateBundleFile: jest.fn(),
	updateYearSync: jest.fn(),
}));

function file(name, path) {
	return { name, path };
}

describe("updateGroupProcess", () => {
	beforeEach(() => {
		jest.clearAllMocks();

		storage.exists.mockResolvedValue(false);
		storage.readFile.mockImplementation(async (path) => {
			if (path.endsWith(".duration")) return "123";
			if (path.endsWith(".md")) return "Summary from DigitalOcean";
			if (path.endsWith(".tags")) return JSON.stringify(["ai", "sync"]);
			return "";
		});
		readBinary.mockResolvedValue(new Blob(["image"]));
		shrinkImage.mockImplementation(async (blob) => blob);
		blobToBase64.mockResolvedValue("thumbnail");

		loadTags.mockResolvedValue({});
		loadDurations.mockResolvedValue({});
		loadSummaries.mockResolvedValue({});
		loadTranscriptions.mockResolvedValue({});

		getListing.mockImplementation(async (path) => {
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

		updateYearSync.mockResolvedValue({
			counter: 0,
			newCount: 0,
			newSessions: [],
		});
	});

	it("combines Wasabi media with DigitalOcean metadata and preferred images", async () => {
		await updateGroupProcess("test", true);

		expect(updateYearSync).toHaveBeenCalledTimes(1);
		const [, year, sessions] = updateYearSync.mock.calls[0];
		expect(year).toBe("2024");
		expect(sessions).toHaveLength(1);

		const [session] = sessions;
		expect(session.id).toBe("2024-05-05 Test Session");
		expect(session.video.path).toBe(
			"wasabi/test/2024/2024-05-05 Test Session.mp4",
		);
		expect(session.image.path).toBe(
			"/aws/sessions/test/2024/2024-05-05 Test Session.png",
		);
		expect(session.duration).toBe(123);
		expect(session.summaryText).toBe("Summary from DigitalOcean");
		expect(session.transcription).toBe(true);
		expect(session.transcriptPath).toBe(
			"/aws/sessions/test/2024/2024-05-05 Test Session.txt",
		);
		expect(session.subtitles.path).toBe(
			"/aws/sessions/test/2024/2024-05-05 Test Session.en.vtt",
		);
		expect(session.thumbnail).toBe("thumbnail");
	});
});
