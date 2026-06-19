import { getSessions } from "@util/domain/sessionFeedEdge";
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

jest.mock("@util/data/string", () => ({
	formatDuration: jest.fn(() => "1 minute"),
}));

jest.mock("@util/domain/sessionFeedEdge", () => ({
	getSessions: jest.fn(),
	getSProxyUrl: jest.fn(
		(path, baseUrl) => (path ? `${baseUrl}/api/rss/s?p=encoded` : null),
	),
	getTranscriptProxyUrlFast: jest.fn(() => null),
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
		Object.defineProperty(global, "crypto", {
			configurable: true,
			value: {
				subtle: {
					digest: jest.fn(async (_algorithm, data) => {
						const hash = new Uint8Array(32);
						hash.fill(data.byteLength % 256);
						return hash.buffer;
					}),
				},
			},
		});
		process.env = {
			...originalEnv,
			SITE_URL: "https://systemconcepts.app",
			AWS_SECRET: "internal-secret",
		};
		global.fetch = jest.fn().mockResolvedValue({
			ok: true,
			json: async () => ({ ok: true }),
		});
		getSessions.mockResolvedValue([]);
	});

	afterAll(() => {
		process.env = originalEnv;
	});

	it("returns the feed with one-hour Vercel caching", async () => {
		const response = await GET(
			makeRequest(
				"https://systemconcepts.app/api/rss?id=user-a&token=token-a&group=a&count=10",
			),
		);

		expect(response.status).toBe(200);
		expect(response.headers.get("Cache-Control")).toBe("public, max-age=300");
		expect(response.headers.get("Vercel-CDN-Cache-Control")).toBe(
			"public, max-age=3600, stale-while-revalidate=86400",
		);
		expect(response.headers.get("ETag")).toBeTruthy();
		expect(response.headers.get("Last-Modified")).toBeTruthy();
	});

	it("returns matching validators and cache policy for 304 responses", async () => {
		const first = await GET(
			makeRequest(
				"https://systemconcepts.app/api/rss?id=user-b&token=token-b",
			),
		);
		const response = await GET(
			makeRequest(
				"https://systemconcepts.app/api/rss?id=user-b&token=token-b",
				first.headers.get("ETag"),
			),
		);

		expect(response.status).toBe(304);
		expect(response.headers.get("ETag")).toBe(first.headers.get("ETag"));
		expect(response.headers.get("Last-Modified")).toBeTruthy();
		expect(response.headers.get("Vercel-CDN-Cache-Control")).toContain(
			"max-age=3600",
		);
	});

	it("does not cache unauthorized responses", async () => {
		global.fetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({ ok: false }),
		});

		const response = await GET(
			makeRequest(
				"https://systemconcepts.app/api/rss?id=user-c&token=bad-token",
			),
		);

		expect(response.status).toBe(403);
		expect(response.headers.get("Cache-Control")).toBe("no-store");
		expect(response.headers.get("Vercel-CDN-Cache-Control")).toBeNull();
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

		expect(global.fetch).toHaveBeenCalledTimes(2);
		expect(getSessions).toHaveBeenNthCalledWith(1, { group: "alpha" });
		expect(getSessions).toHaveBeenNthCalledWith(2, { group: "beta" });
	});

	it("does not cache generation failures", async () => {
		getSessions.mockRejectedValueOnce(new Error("storage unavailable"));

		const response = await GET(
			makeRequest(
				"https://systemconcepts.app/api/rss?id=user-f&token=token-f",
			),
		);

		expect(response.status).toBe(500);
		expect(response.headers.get("Cache-Control")).toBe("no-store");
	});
});
