import {
	getSProxyUrl,
	getTranscriptProxyUrlFast,
} from "@util/domain/sessionFeedEdge";
import { buildRssEtag, buildRssFeed } from "./rssFeedResponse";

jest.mock("@util/domain/sessionFeedEdge", () => ({
	getSProxyUrl: jest.fn(() => "https://systemconcepts.app/api/rss/s?p=encoded"),
	getTranscriptProxyUrlFast: jest.fn(() => null),
}));

jest.mock("@util/data/string", () => ({
	formatDuration: jest.fn(() => "1:00"),
}));

describe("rssFeedResponse", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		getSProxyUrl.mockResolvedValue(
			"https://systemconcepts.app/api/rss/s?p=encoded",
		);
		getTranscriptProxyUrlFast.mockResolvedValue(null);
	});

	it("uses the canonical self URL without auth params", async () => {
		const { rss } = await buildRssFeed({
			sessions: [
				{
					id: "one",
					group: "alpha",
					year: "2025",
					date: "2025-01-01",
					name: "Session",
				},
			],
			group: "alpha",
			baseUrl: "https://systemconcepts.app",
			canonicalSelfUrl:
				"https://systemconcepts.app/api/rss?group=alpha&count=10",
		});

		expect(rss).toContain(
			'<atom:link href="https://systemconcepts.app/api/rss?group=alpha&amp;count=10" rel="self" type="application/rss+xml" />',
		);
	});

	it("escapes XML special characters in titles and descriptions", async () => {
		const { rss } = await buildRssFeed({
			sessions: [
				{
					group: "a&b",
					year: "2025",
					date: "2025-01-01",
					name: `Title <with> "quotes" & 'apos'`,
					summaryText: "A <synopsis> & more",
					tags: ["t<ag>", "ok"],
					duration: 61.4,
				},
			],
			group: null,
			baseUrl: "https://example.com",
			canonicalSelfUrl: "https://example.com/api/rss",
		});

		expect(rss).toContain("&lt;");
		expect(rss).toContain("&gt;");
		expect(rss).toContain("&amp;");
		expect(rss).toContain("&quot;");
		expect(rss).toContain("&apos;");
		expect(rss).toContain("Duration:");
		expect(rss).toContain("Synopsis:");
		expect(rss).toContain("<title>System Concepts - Sessions</title>");
	});

	it("builds mp4 video, m4a audio, and mpeg enclosures", async () => {
		getSProxyUrl.mockImplementation(async (path) =>
			path ? `https://cdn/${path}` : null,
		);

		const { rss } = await buildRssFeed({
			sessions: [
				{
					group: "g",
					year: "2025",
					date: "2025-01-01",
					name: "Video",
					video: { path: "a/b.mp4", size: 10 },
				},
				{
					group: "g",
					year: "2025",
					date: "2025-01-02",
					name: "M4A",
					audio: { path: "a/b.m4a", size: 20 },
				},
				{
					group: "g",
					year: "2025",
					date: "2025-01-03",
					name: "MP3",
					audio: { path: "a/b.mp3" },
				},
			],
			group: "g",
			baseUrl: "https://example.com",
			canonicalSelfUrl: "https://example.com/rss",
		});

		expect(rss).toContain('type="video/mp4"');
		expect(rss).toContain('type="audio/x-m4a"');
		expect(rss).toContain('type="audio/mpeg"');
		expect(rss).toContain('length="10"');
		expect(rss).toContain('length="0"');
	});

	it("uses thumbnail when present and falls back to cover art", async () => {
		getSProxyUrl.mockImplementation(async (path) => {
			if (!path) return null;
			return `https://cdn/${path}`;
		});

		const withImage = await buildRssFeed({
			sessions: [
				{
					group: "g",
					year: "2025",
					date: "2025-01-01",
					name: "Img",
					image: { path: "thumb.jpg" },
				},
			],
			group: "g",
			baseUrl: "https://example.com",
			canonicalSelfUrl: "https://example.com/rss",
		});
		expect(withImage.rss).toContain('href="https://cdn/thumb.jpg"');

		const withoutImage = await buildRssFeed({
			sessions: [
				{
					group: "g",
					year: "2025",
					date: "2025-01-01",
					name: "NoImg",
				},
			],
			group: "g",
			baseUrl: "https://example.com",
			canonicalSelfUrl: "https://example.com/rss",
		});
		expect(withoutImage.rss).toContain(
			'href="https://example.com/images/rss-cover.jpg"',
		);
	});

	it("emits transcript tags for vtt and plain paths", async () => {
		getTranscriptProxyUrlFast
			.mockResolvedValueOnce("https://example.com/t.vtt")
			.mockResolvedValueOnce("https://example.com/t.txt");

		const vtt = await buildRssFeed({
			sessions: [
				{
					group: "g",
					year: "2025",
					date: "2025-01-01",
					name: "VTT",
					subtitles: { path: "file.vtt" },
				},
			],
			group: "g",
			baseUrl: "https://example.com",
			canonicalSelfUrl: "https://example.com/rss",
		});
		expect(vtt.rss).toContain('type="text/vtt"');
		expect(vtt.rss).toContain("https://example.com/t.vtt");

		const plain = await buildRssFeed({
			sessions: [
				{
					group: "g",
					year: "2025",
					date: "2025-01-02",
					name: "TXT",
					transcriptPath: "file.txt",
				},
			],
			group: "g",
			baseUrl: "https://example.com",
			canonicalSelfUrl: "https://example.com/rss",
		});
		expect(plain.rss).toContain('type="text/plain"');
	});

	it("omits duration and synopsis when absent and handles empty sessions", async () => {
		const { rss, maxDate } = await buildRssFeed({
			sessions: [],
			group: "alpha",
			baseUrl: "https://example.com",
			canonicalSelfUrl: "https://example.com/rss",
		});
		expect(rss).toContain("System Concepts - alpha Sessions");
		expect(maxDate).toBeTruthy();
		expect(rss).not.toContain("<item>");
	});

	it("skips enclosure when media has no path", async () => {
		const { rss } = await buildRssFeed({
			sessions: [
				{
					group: "g",
					year: "2025",
					date: "2025-01-01",
					name: "NoMedia",
					audio: { size: 1 },
				},
			],
			group: "g",
			baseUrl: "https://example.com",
			canonicalSelfUrl: "https://example.com/rss",
		});
		expect(rss).not.toContain("<enclosure");
	});

	it("builds a stable etag hash for the rss body", async () => {
		const digest = jest.fn(async () => new Uint8Array([1, 2, 255]).buffer);
		Object.defineProperty(globalThis, "crypto", {
			configurable: true,
			value: { subtle: { digest } },
		});
		global.TextEncoder = class {
			encode(value) {
				return Buffer.from(String(value));
			}
		};

		const etag = await buildRssEtag("<rss>hello</rss>");
		expect(etag).toBe("0102ff");
		expect(digest).toHaveBeenCalled();
	});
});
