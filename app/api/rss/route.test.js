import { readApiCacheEdge } from "@util/api/apiCacheEdge";
import { buildCanonicalApiUrl } from "@util/api/apiCacheKeys";
import { authenticateEdge, scheduleApiCacheWrite } from "@util/api/edgeApi";
import { logger } from "@util/api/logger";
import { buildRssFeed } from "@util/domain/rssFeedResponse";
import { getSessions, loadManifest } from "@util/domain/sessionFeedEdge";
import { TextEncoder } from "util";
import { GET } from "./route";

jest.mock("next/server", () => {
	class TestHeaders {
		constructor(values = {}) {
			this.values = new Map(
				Object.entries(values).map(([key, value]) => [
					key.toLowerCase(),
					String(value),
				]),
			);
		}

		get(name) {
			return this.values.get(name.toLowerCase()) ?? null;
		}
	}

	class TestResponse {
		constructor(body, init = {}) {
			this.body = body;
			this.status = init.status || 200;
			this.headers = new TestHeaders(init.headers);
		}
	}

	global.Response = TestResponse;

	return {
		NextResponse: TestResponse,
	};
});

jest.mock("@util/api/apiCacheEdge", () => ({
	readApiCacheEdge: jest.fn(),
}));

jest.mock("@util/api/apiCacheKeys", () => ({
	buildApiCacheKey: jest.fn(async () => "cache-key"),
	buildCanonicalApiUrl: jest.fn(
		() => "https://systemconcepts.app/api/rss?group=a&count=10",
	),
	getContentParams: jest.fn(() => ({ group: "a", count: 10 })),
	getManifestFingerprint: jest.fn(() => "fingerprint"),
}));

jest.mock("@util/api/edgeApi", () => ({
	authenticateEdge: jest.fn(),
	scheduleApiCacheWrite: jest.fn(),
}));
jest.mock("@util/api/logger", () => ({
	logger: {
		debug: jest.fn(),
		error: jest.fn(),
		info: jest.fn(),
		warn: jest.fn(),
	},
}));

jest.mock("@util/domain/rssFeedResponse", () => ({
	buildRssFeed: jest.fn(() => ({
		rss: '<?xml version="1.0"?><rss><channel><item><pubDate>Mon, 01 Jan 2024 00:00:00 +0000</pubDate></item></channel></rss>',
		maxDate: "Mon, 01 Jan 2024 00:00:00 GMT",
	})),
	buildRssEtag: jest.fn(async () => "abc123"),
}));

jest.mock("@util/domain/sessionFeedEdge", () => ({
	getSessions: jest.fn(),
	loadManifest: jest.fn(),
	sortSessions: jest.fn((sessions) => sessions),
}));

function makeRequest(url, ifNoneMatch = null) {
	return {
		url,
		headers: {
			get: (name) =>
				name.toLowerCase() === "if-none-match" ? ifNoneMatch : null,
		},
	};
}

describe("/api/rss", () => {
	const originalEnv = process.env;

	beforeEach(() => {
		jest.clearAllMocks();
		global.TextEncoder = TextEncoder;
		process.env = {
			...originalEnv,
			SITE_URL: "https://systemconcepts.app",
			AWS_SECRET: "internal-secret",
		};
		authenticateEdge.mockResolvedValue(true);
		loadManifest.mockResolvedValue([]);
		getSessions.mockResolvedValue([]);
		readApiCacheEdge.mockResolvedValue(null);
	});

	afterAll(() => {
		process.env = originalEnv;
	});

	it("returns the feed with six-hour Vercel caching", async () => {
		const response = await GET(
			makeRequest(
				"https://systemconcepts.app/api/rss?id=user-a&token=token-a&group=a&count=10",
			),
		);

		expect(response.status).toBe(200);
		expect(response.headers.get("Cache-Control")).toBe("public, max-age=300");
		expect(response.headers.get("Vercel-CDN-Cache-Control")).toBe(
			"public, max-age=21600, stale-while-revalidate=86400",
		);
		expect(response.headers.get("ETag")).toBe('"abc123"');
		expect(buildCanonicalApiUrl).toHaveBeenCalled();
	});

	it("publishes 50 sessions by default", async () => {
		getSessions.mockResolvedValue(
			Array.from({ length: 60 }, (_, index) => ({ id: index })),
		);

		await GET(
			makeRequest("https://systemconcepts.app/api/rss?id=user-a&token=token-a"),
		);

		expect(buildRssFeed).toHaveBeenCalledWith(
			expect.objectContaining({ sessions: expect.any(Array) }),
		);
		expect(buildRssFeed.mock.calls[0][0].sessions).toHaveLength(50);
	});

	it("returns matching validators and cache policy for 304 responses", async () => {
		const first = await GET(
			makeRequest("https://systemconcepts.app/api/rss?id=user-b&token=token-b"),
		);
		const response = await GET(
			makeRequest(
				"https://systemconcepts.app/api/rss?id=user-b&token=token-b",
				first.headers.get("ETag"),
			),
		);

		expect(response.status).toBe(304);
		expect(response.headers.get("ETag")).toBe(first.headers.get("ETag"));
	});

	it("uses shared cache without rebuilding sessions", async () => {
		readApiCacheEdge.mockResolvedValue(
			'<?xml version="1.0"?><rss><channel><item><pubDate>Mon, 01 Jan 2024 00:00:00 +0000</pubDate></item></channel></rss>',
		);

		await GET(
			makeRequest(
				"https://systemconcepts.app/api/rss?id=user-c&token=token-c&group=alpha",
			),
		);

		expect(getSessions).not.toHaveBeenCalled();
		expect(buildRssFeed).not.toHaveBeenCalled();
	});

	it("does not cache unauthorized responses", async () => {
		authenticateEdge.mockResolvedValue(false);

		const response = await GET(
			makeRequest(
				"https://systemconcepts.app/api/rss?id=user-c&token=bad-token",
			),
		);

		expect(response.status).toBe(403);
		expect(response.headers.get("Cache-Control")).toBe("no-store");
	});

	it("keeps query variants distinct when fetching and rendering feeds", async () => {
		await GET(
			makeRequest(
				"https://systemconcepts.app/api/rss?id=user-d&token=token-d&group=alpha&count=10",
			),
		);
		await GET(
			makeRequest(
				"https://systemconcepts.app/api/rss?id=user-e&token=token-e&group=beta&count=20",
			),
		);

		expect(getSessions).toHaveBeenNthCalledWith(1, { group: "alpha" });
		expect(getSessions).toHaveBeenNthCalledWith(2, { group: "beta" });
		expect(scheduleApiCacheWrite).toHaveBeenCalledTimes(2);
	});

	it("does not cache generation failures", async () => {
		getSessions.mockRejectedValueOnce(new Error("storage unavailable"));

		const response = await GET(
			makeRequest("https://systemconcepts.app/api/rss?id=user-f&token=token-f"),
		);

		expect(response.status).toBe(500);
		expect(response.headers.get("Cache-Control")).toBe("no-store");
		expect(logger.error).toHaveBeenCalledWith("RSS Error:", expect.any(Error));
	});
});
