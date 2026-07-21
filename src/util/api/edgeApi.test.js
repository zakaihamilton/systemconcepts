import {
	__clearEdgeApiCachesForTests,
	authenticateEdge,
	enforceRateLimitEdge,
	getClientIp,
	scheduleApiCacheWrite,
} from "./edgeApi";

function searchParamsOf(entries) {
	return new URLSearchParams(entries);
}

function jsonResponse(body, ok = true, status = ok ? 200 : 500) {
	return Promise.resolve({
		ok,
		status,
		json: () => Promise.resolve(body),
	});
}

describe("authenticateEdge", () => {
	beforeEach(() => {
		global.fetch = jest.fn();
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	it("returns false when the id or token is missing", async () => {
		await expect(
			authenticateEdge(searchParamsOf({ id: "user" })),
		).resolves.toBe(false);
		await expect(
			authenticateEdge(searchParamsOf({ token: "abc" })),
		).resolves.toBe(false);
		expect(global.fetch).not.toHaveBeenCalled();
	});

	it("returns true when the verify endpoint confirms the token", async () => {
		global.fetch.mockResolvedValue(jsonResponse({ ok: true }));
		await expect(
			authenticateEdge(searchParamsOf({ id: "user", token: "abc" })),
		).resolves.toBe(true);
		expect(global.fetch).toHaveBeenCalledWith(
			expect.stringContaining("/api/rss/verify"),
			expect.objectContaining({ method: "POST" }),
		);
	});

	it("returns false when the verify endpoint responds with ok: false", async () => {
		global.fetch.mockResolvedValue(jsonResponse({ ok: false }));
		await expect(
			authenticateEdge(searchParamsOf({ id: "user", token: "abc" })),
		).resolves.toBe(false);
	});

	it("returns false when the verify endpoint returns a non-ok status", async () => {
		global.fetch.mockResolvedValue(jsonResponse(null, false, 401));
		await expect(
			authenticateEdge(searchParamsOf({ id: "user", token: "abc" })),
		).resolves.toBe(false);
	});

	it("returns false when the fetch call throws", async () => {
		global.fetch.mockRejectedValue(new Error("network down"));
		await expect(
			authenticateEdge(searchParamsOf({ id: "user", token: "abc" })),
		).resolves.toBe(false);
	});
});

describe("enforceRateLimitEdge", () => {
	beforeEach(() => {
		__clearEdgeApiCachesForTests();
		global.fetch = jest.fn();
	});

	afterEach(() => {
		__clearEdgeApiCachesForTests();
		jest.restoreAllMocks();
	});

	it("bypasses external rate-limit persistence only in the Playwright harness", async () => {
		const previous = process.env.PLAYWRIGHT;
		process.env.PLAYWRIGHT = "1";
		await expect(enforceRateLimitEdge("203.0.113.1")).resolves.toBe(true);
		expect(global.fetch).not.toHaveBeenCalled();
		if (previous === undefined) delete process.env.PLAYWRIGHT;
		else process.env.PLAYWRIGHT = previous;
	});

	it("returns false when no ip is provided", async () => {
		await expect(enforceRateLimitEdge(null)).resolves.toBe(false);
		expect(global.fetch).not.toHaveBeenCalled();
	});

	it("returns true and caches the result when the endpoint allows the request", async () => {
		global.fetch.mockResolvedValue(jsonResponse({ ok: true }));
		await expect(enforceRateLimitEdge("203.0.113.2")).resolves.toBe(true);
		expect(global.fetch).toHaveBeenCalledTimes(1);

		// Cached result is reused without another fetch call.
		await expect(enforceRateLimitEdge("203.0.113.2")).resolves.toBe(true);
		expect(global.fetch).toHaveBeenCalledTimes(1);
	});

	it("returns false and caches the result when the endpoint denies the request", async () => {
		global.fetch.mockResolvedValue(jsonResponse({ ok: false }));
		await expect(enforceRateLimitEdge("203.0.113.3")).resolves.toBe(false);
		await expect(enforceRateLimitEdge("203.0.113.3")).resolves.toBe(false);
		expect(global.fetch).toHaveBeenCalledTimes(1);
	});

	it("returns false when the endpoint responds with a non-ok status", async () => {
		global.fetch.mockResolvedValue(jsonResponse(null, false, 500));
		await expect(enforceRateLimitEdge("203.0.113.4")).resolves.toBe(false);
	});

	it("fails open (returns true) when the fetch call throws", async () => {
		global.fetch.mockRejectedValue(new Error("network down"));
		await expect(enforceRateLimitEdge("203.0.113.5")).resolves.toBe(true);
	});

	it("passes the configured limit and window to the endpoint", async () => {
		global.fetch.mockResolvedValue(jsonResponse({ ok: true }));
		await enforceRateLimitEdge("203.0.113.6", { limit: 10, windowMs: 5000 });
		const [, options] = global.fetch.mock.calls[0];
		expect(JSON.parse(options.body)).toEqual({
			ip: "203.0.113.6",
			limit: 10,
			windowMs: 5000,
		});
	});

	it("refetches when the cached rate-limit entry has expired", async () => {
		jest.useFakeTimers();
		global.fetch.mockResolvedValue(jsonResponse({ ok: true }));
		await enforceRateLimitEdge("203.0.113.7");
		jest.advanceTimersByTime(6000);
		await enforceRateLimitEdge("203.0.113.7");
		expect(global.fetch).toHaveBeenCalledTimes(2);
		jest.useRealTimers();
	});
});

describe("scheduleApiCacheWrite", () => {
	beforeEach(() => {
		global.fetch = jest.fn();
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	it("posts the cache write payload to the internal endpoint", () => {
		global.fetch.mockResolvedValue({ ok: true });
		scheduleApiCacheWrite("rss", "abc", "<xml/>");
		expect(global.fetch).toHaveBeenCalledWith(
			expect.stringContaining("/api/internal/api-cache"),
			expect.objectContaining({
				method: "POST",
				body: JSON.stringify({ type: "rss", key: "abc", body: "<xml/>" }),
			}),
		);
	});

	it("swallows errors from the fetch call", async () => {
		global.fetch.mockRejectedValue(new Error("network down"));
		expect(() => scheduleApiCacheWrite("rss", "abc", "<xml/>")).not.toThrow();
		await Promise.resolve();
		await Promise.resolve();
	});
});

describe("getClientIp", () => {
	it("reads the vercel forwarded-for header", () => {
		const request = {
			headers: new Headers({ "x-vercel-forwarded-for": "198.51.100.4" }),
		};
		expect(getClientIp(request)).toBe("198.51.100.4");
	});

	it("returns unknown when the header is missing", () => {
		const request = { headers: new Headers() };
		expect(getClientIp(request)).toBe("unknown");
	});
});
