import { buildRssFeed } from "./rssFeedResponse";

jest.mock("@util/domain/sessionFeedEdge", () => ({
	getSProxyUrl: jest.fn(() => "https://systemconcepts.app/api/rss/s?p=encoded"),
	getTranscriptProxyUrlFast: jest.fn(() => null),
}));

describe("rssFeedResponse", () => {
	it("uses the canonical self URL without auth params", () => {
		const { rss } = buildRssFeed({
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
});
