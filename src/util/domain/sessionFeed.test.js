import { metadataInfo as awsMetadataInfo } from "@util/storage/aws";
import { metadataInfo as wasabiMetadataInfo } from "@util/storage/wasabi";
import { TextDecoder } from "util";

jest.mock("@util/storage/aws", () => ({
	downloadData: jest.fn(),
	metadataInfo: jest.fn(),
}));

jest.mock("@util/storage/wasabi", () => ({
	metadataInfo: jest.fn(),
}));

describe("sessionFeed transcript URLs", () => {
	let getSProxyUrl;
	let getTranscriptProxyUrl;
	let clearSessionFeedCaches;

	beforeEach(() => {
		jest.clearAllMocks();
		global.TextDecoder = TextDecoder;
		({
			__clearSessionFeedCachesForTests: clearSessionFeedCaches,
			getSProxyUrl,
			getTranscriptProxyUrl,
		} = require("@util/domain/sessionFeed"));
		clearSessionFeedCaches();
	});

	it("normalizes legacy aws paths before building proxy URLs", () => {
		const url = getSProxyUrl(
			"/aws/sessions/american/2025/2025-09-12 Numb.txt",
			"https://systemconcepts.app",
		);
		const encodedPath = new URL(url).searchParams.get("p");

		expect(Buffer.from(encodedPath, "base64url").toString("utf8")).toBe(
			"sessions/american/2025/2025-09-12 Numb.txt",
		);
	});

	it("does not emit stale DigitalOcean subtitle paths when a Wasabi transcript exists", async () => {
		awsMetadataInfo.mockResolvedValue(null);
		wasabiMetadataInfo.mockResolvedValue({ type: "text/plain" });

		const url = await getTranscriptProxyUrl(
			{
				id: "2025-09-12 Numb",
				group: "american",
				year: "2025",
				transcription: true,
				subtitles: {
					path: "/aws/sessions/american/2025/2025-09-12 Numb.vtt",
				},
				video: {
					path: "wasabi/american/2025/2025-09-12 Numb.mp4",
				},
			},
			"https://systemconcepts.app",
		);
		const encodedPath = new URL(url).searchParams.get("p");

		expect(awsMetadataInfo).toHaveBeenCalledWith({
			path: "sessions/american/2025/2025-09-12 Numb.vtt",
		});
		expect(wasabiMetadataInfo).toHaveBeenCalledWith({
			path: "american/2025/2025-09-12 Numb.txt",
		});
		expect(Buffer.from(encodedPath, "base64url").toString("utf8")).toBe(
			"wasabi/american/2025/2025-09-12 Numb.txt",
		);
	});

	it("does not return a yearly zip transcript URL from the sessions API", async () => {
		awsMetadataInfo.mockResolvedValue(null);
		wasabiMetadataInfo.mockResolvedValue(null);

		const url = await getTranscriptProxyUrl(
			{
				id: "2025-09-12 Numb",
				group: "american",
				year: "2025",
				transcription: true,
				audio: {
					path: "/aws/sessions/american/2025/2025-09-12 Numb.m4a",
				},
			},
			"https://systemconcepts.app",
		);

		expect(url).toBeNull();
	});

	it("returns a signed-redirect URL for an AWS transcript when a summary exists without transcription metadata", async () => {
		awsMetadataInfo.mockImplementation(({ path }) =>
			path ===
			"sessions/american/2026/2026-04-28 Overview - Effort vs Finding Favor.txt"
				? Promise.resolve({ type: "text/plain" })
				: Promise.resolve(null),
		);
		wasabiMetadataInfo.mockResolvedValue(null);

		const url = await getTranscriptProxyUrl(
			{
				id: "2026-04-28 Overview - Effort vs Finding Favor",
				group: "american",
				year: "2026",
				summaryText: "Summary created from the transcription.",
				audio: {
					path: "/aws/sessions/american/2026/2026-04-28 Overview - Effort vs Finding Favor.m4a",
				},
			},
			"https://systemconcepts.app",
		);

		const parsed = new URL(url);
		expect(parsed.pathname).toBe("/api/rss/s");
		expect(
			Buffer.from(parsed.searchParams.get("p"), "base64url").toString("utf8"),
		).toBe(
			"sessions/american/2026/2026-04-28 Overview - Effort vs Finding Favor.txt",
		);
	});

	it("reuses transcript metadata lookups for repeated AWS transcript checks", async () => {
		awsMetadataInfo.mockResolvedValue({ type: "text/plain" });
		wasabiMetadataInfo.mockResolvedValue(null);
		const session = {
			id: "2026-06-24 Cached Transcript",
			group: "compute",
			year: "2026",
			transcriptPath:
				"/aws/sessions/compute/2026/2026-06-24 Cached Transcript.txt",
		};

		const firstUrl = await getTranscriptProxyUrl(
			session,
			"https://systemconcepts.app",
		);
		const secondUrl = await getTranscriptProxyUrl(
			session,
			"https://systemconcepts.app",
		);

		expect(firstUrl).toBe(secondUrl);
		expect(awsMetadataInfo).toHaveBeenCalledTimes(1);
		expect(awsMetadataInfo).toHaveBeenCalledWith({
			path: "sessions/compute/2026/2026-06-24 Cached Transcript.txt",
		});
	});

	it("does not fall back to a yearly zip transcript URL when no standalone transcript exists", async () => {
		awsMetadataInfo.mockResolvedValue(null);
		wasabiMetadataInfo.mockResolvedValue(null);

		const url = await getTranscriptProxyUrl(
			{
				id: "2026-04-28 Overview - Effort vs Finding Favor",
				group: "american",
				year: "2026",
				summaryText: "Summary created from the transcription.",
				audio: {
					path: "/aws/sessions/american/2026/2026-04-28 Overview - Effort vs Finding Favor.m4a",
				},
			},
			"https://systemconcepts.app",
		);

		expect(url).toBeNull();
	});
});
