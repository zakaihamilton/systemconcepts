import { authenticateTokenRequest, enforceRateLimit } from "@util/api/api";
import {
	getSessions,
	getTranscriptProxyUrl,
	sortSessions,
} from "@util/domain/sessionFeed";
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

jest.mock("@util/api/api", () => ({
	authenticateTokenRequest: jest.fn(),
	enforceRateLimit: jest.fn(),
	getNonNegativeInt: jest.fn((value, fallback = 0) => {
		const parsed = Number.parseInt(value || "", 10);
		return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
	}),
	getPositiveInt: jest.fn((value, fallback, max) => {
		const parsed = Number.parseInt(value || "", 10);
		const safe = Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
		return Math.min(safe, max);
	}),
	JSON_HEADERS: {
		"Content-Type": "application/json; charset=utf-8",
	},
	NO_CACHE_HEADERS: {
		"Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
		Pragma: "no-cache",
		Expires: "0",
	},
}));

jest.mock("@util/domain/sessionFeed", () => ({
	getSessions: jest.fn(),
	getSProxyUrl: jest.fn((path, baseUrl) => `${baseUrl}/proxy/${path}`),
	getTranscriptProxyUrl: jest.fn(),
	sortSessions: jest.fn((sessions) => sessions),
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
		enforceRateLimit.mockResolvedValue(null);
		authenticateTokenRequest.mockResolvedValue({
			id: "user",
			role: "student",
		});
		getSessions.mockResolvedValue([]);
		getTranscriptProxyUrl.mockResolvedValue(null);
	});

	it("caches successful responses in the browser and Vercel CDN", async () => {
		const response = await GET(makeRequest("?id=user&token=token"));

		expect(response.status).toBe(200);
		expect(response.headers.get("Cache-Control")).toBe("private, max-age=300");
		expect(response.headers.get("Vercel-CDN-Cache-Control")).toBe(
			"public, max-age=300, stale-while-revalidate=3600",
		);
	});

	it("keeps query filtering and pagination behavior distinct", async () => {
		const sessions = [
			{ id: "one", group: "alpha", tags: ["one"], date: "2025-01-01" },
			{ id: "two", group: "alpha", tags: ["two"], date: "2025-01-02" },
			{ id: "three", group: "beta", tags: ["two"], date: "2025-01-03" },
		];
		getSessions.mockResolvedValue(sessions.slice(0, 2));

		const response = await GET(
			makeRequest("?id=user&token=token&group=alpha&tag=two&index=0&count=1"),
		);

		expect(getSessions).toHaveBeenCalledWith({ group: "alpha" });
		expect(sortSessions).toHaveBeenCalledWith([sessions[1]]);
		await expect(response.json()).resolves.toEqual([
			expect.objectContaining({ id: "two", group: "alpha" }),
		]);
	});

	it("does not cache unauthorized responses", async () => {
		authenticateTokenRequest.mockResolvedValue(null);

		const response = await GET(makeRequest("?id=user&token=bad"));

		expect(response.status).toBe(403);
		expect(response.headers.get("Cache-Control")).toContain("no-store");
		expect(response.headers.get("Vercel-CDN-Cache-Control")).toBeNull();
	});

	it("does not cache rate-limited responses", async () => {
		enforceRateLimit.mockResolvedValue(
			Response.json({ err: "Too many requests" }, { status: 429 }),
		);

		const response = await GET(makeRequest("?id=user&token=token"));

		expect(response.status).toBe(429);
		expect(response.headers.get("Cache-Control")).toContain("no-store");
		expect(response.headers.get("Vercel-CDN-Cache-Control")).toBeNull();
		expect(authenticateTokenRequest).not.toHaveBeenCalled();
	});

	it("does not cache generation failures", async () => {
		getSessions.mockRejectedValue(new Error("storage unavailable"));

		const response = await GET(makeRequest("?id=user&token=token"));

		expect(response.status).toBe(500);
		expect(response.headers.get("Cache-Control")).toContain("no-store");
		expect(response.headers.get("Vercel-CDN-Cache-Control")).toBeNull();
	});
});
