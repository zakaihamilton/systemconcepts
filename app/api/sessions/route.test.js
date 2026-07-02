import { readApiCacheEdge } from "@util/api/apiCacheEdge";
import {
	buildApiCacheKey,
	getContentParams,
	getManifestFingerprint,
} from "@util/api/apiCacheKeys";
import {
	authenticateEdge,
	enforceRateLimitEdge,
	scheduleApiCacheWrite,
} from "@util/api/edgeApi";
import { getSessions, loadManifest } from "@util/domain/sessionFeedEdge";
import { filterSessions } from "@util/domain/sessionsApiResponse";
import { GET } from "./route";

jest.mock("@util/api/httpHeaders", () => ({
	JSON_HEADERS: {
		"Content-Type": "application/json; charset=utf-8",
	},
	NO_CACHE_HEADERS: {
		"Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
		Pragma: "no-cache",
		Expires: "0",
	},
}));

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

		set(name, value) {
			this.values.set(name.toLowerCase(), String(value));
		}
	}

	class TestResponse {
		constructor(body, init = {}) {
			this.body = body;
			this.status = init.status || 200;
			this.headers = new TestHeaders(init.headers);
		}

		async json() {
			return JSON.parse(this.body);
		}

		static json(body, init = {}) {
			return new TestResponse(JSON.stringify(body), {
				...init,
				headers: {
					"Content-Type": "application/json",
					...init.headers,
				},
			});
		}
	}

	global.Response = TestResponse;

	return { NextResponse: TestResponse };
});

jest.mock("@util/api/apiCacheEdge", () => ({
	readApiCacheEdge: jest.fn(),
}));

jest.mock("@util/api/apiCacheKeys", () => ({
	buildApiCacheKey: jest.fn(async () => "cache-key"),
	getContentParams: jest.fn(() => ({ group: "alpha", count: 100, index: 0 })),
	getManifestFingerprint: jest.fn(() => "fingerprint"),
}));

jest.mock("@util/api/edgeApi", () => ({
	authenticateEdge: jest.fn(),
	enforceRateLimitEdge: jest.fn(),
	getClientIp: jest.fn(() => "127.0.0.1"),
	scheduleApiCacheWrite: jest.fn(),
}));

jest.mock("@util/domain/sessionsApiResponse", () => ({
	buildSessionsJson: jest.fn(() => "[]"),
	filterSessions: jest.fn((sessions) => sessions),
}));

jest.mock("@util/domain/sessionFeedEdge", () => ({
	getSessions: jest.fn(),
	loadManifest: jest.fn(),
}));

function makeRequest(query = "") {
	return {
		url: `https://systemconcepts.app/api/sessions${query}`,
		headers: { get: jest.fn(() => null) },
	};
}

describe("/api/sessions", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		enforceRateLimitEdge.mockResolvedValue(true);
		authenticateEdge.mockResolvedValue(true);
		loadManifest.mockResolvedValue([]);
		getSessions.mockResolvedValue([]);
		readApiCacheEdge.mockResolvedValue(null);
	});

	it("caches successful responses in the browser and Vercel CDN", async () => {
		const response = await GET(makeRequest("?id=user&token=token"));

		expect(response.status).toBe(200);
		expect(response.headers.get("Cache-Control")).toBe("public, max-age=300");
		expect(response.headers.get("Vercel-CDN-Cache-Control")).toBe(
			"public, max-age=300, stale-while-revalidate=3600",
		);
	});

	it("keeps query filtering and pagination behavior distinct", async () => {
		const sessions = [
			{ id: "one", group: "alpha", tags: ["one"], date: "2025-01-01" },
			{ id: "two", group: "alpha", tags: ["two"], date: "2025-01-02" },
		];
		getSessions.mockResolvedValue(sessions);
		filterSessions.mockReturnValue([sessions[1]]);

		const request = makeRequest(
			"?id=user&token=token&group=alpha&tag=two&index=0&count=1",
		);
		const response = await GET(request);

		expect(getSessions).toHaveBeenCalledWith({ group: "alpha" });
		expect(filterSessions).toHaveBeenCalledWith(
			sessions,
			expect.any(URLSearchParams),
		);
		await expect(response.json()).resolves.toEqual([]);
	});

	it("reuses shared S3 cache for different authenticated users", async () => {
		readApiCacheEdge.mockResolvedValue('[{"id":"cached"}]');

		const first = await GET(
			makeRequest("?id=user-a&token=token-a&group=alpha"),
		);
		const second = await GET(
			makeRequest("?id=user-b&token=token-b&group=alpha"),
		);

		expect(first.status).toBe(200);
		expect(second.status).toBe(200);
		expect(getSessions).not.toHaveBeenCalled();
		expect(buildApiCacheKey).toHaveBeenCalledTimes(2);
		expect(getContentParams).toHaveBeenCalledTimes(2);
		expect(getManifestFingerprint).toHaveBeenCalledTimes(2);
	});

	it("writes to shared cache on miss", async () => {
		await GET(makeRequest("?id=user&token=token&group=alpha"));

		expect(scheduleApiCacheWrite).toHaveBeenCalledWith(
			"sessions",
			"cache-key",
			"[]",
		);
	});

	it("does not cache unauthorized responses", async () => {
		authenticateEdge.mockResolvedValue(false);

		const response = await GET(makeRequest("?id=user&token=bad"));

		expect(response.status).toBe(403);
		expect(response.headers.get("Cache-Control")).toContain("no-store");
	});

	it("does not cache rate-limited responses", async () => {
		enforceRateLimitEdge.mockResolvedValue(false);

		const response = await GET(makeRequest("?id=user&token=token"));

		expect(response.status).toBe(429);
		expect(response.headers.get("Cache-Control")).toContain("no-store");
		expect(authenticateEdge).not.toHaveBeenCalled();
	});

	it("does not cache generation failures", async () => {
		getSessions.mockRejectedValue(new Error("storage unavailable"));

		const response = await GET(makeRequest("?id=user&token=token"));

		expect(response.status).toBe(500);
		expect(response.headers.get("Cache-Control")).toContain("no-store");
	});
});
