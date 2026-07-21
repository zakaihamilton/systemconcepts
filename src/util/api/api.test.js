import { checkRateLimit } from "@util/auth/rateLimit";
import { findRecord } from "@util/storage/mongo";
import {
	__clearAuthCacheForTests,
	authenticateTokenRequest,
	enforceRateLimit,
	getApiToken,
	getClientIp,
	getNonNegativeInt,
	getPositiveInt,
	jsonError,
	jsonSuccess,
	timingSafeEqual,
} from "./api";

jest.mock("@util/auth/rateLimit", () => ({
	checkRateLimit: jest.fn(),
}));
jest.mock("@util/storage/mongo", () => ({
	findRecord: jest.fn(),
}));
jest.mock("next/server", () => ({
	NextResponse: {
		json: (body, init = {}) => ({
			status: init.status || 200,
			headers: init.headers || {},
			json: async () => body,
		}),
	},
}));

describe("jsonError / jsonSuccess", () => {
	it("builds an error response with the given status and merged headers", () => {
		const response = jsonError("bad request", 400, { "X-Test": "1" });
		expect(response.status).toBe(400);
		expect(response.headers).toMatchObject({
			"Content-Type": "application/json; charset=utf-8",
			"X-Test": "1",
		});
	});

	it("defaults to a 500 status", () => {
		const response = jsonError("boom");
		expect(response.status).toBe(500);
	});

	it("builds a success response with the given data and status", async () => {
		const response = jsonSuccess({ ok: true }, 201);
		expect(response.status).toBe(201);
		await expect(response.json()).resolves.toEqual({ ok: true });
	});
});

describe("getClientIp", () => {
	it("prefers the x-forwarded-for header and takes the first entry", () => {
		const request = {
			headers: new Headers({
				"x-forwarded-for": "203.0.113.9, 10.0.0.1",
			}),
		};
		expect(getClientIp(request)).toBe("203.0.113.9");
	});

	it("falls back to x-real-ip", () => {
		const request = {
			headers: new Headers({ "x-real-ip": "198.51.100.2" }),
		};
		expect(getClientIp(request)).toBe("198.51.100.2");
	});

	it("returns unknown when neither header is present", () => {
		const request = { headers: new Headers() };
		expect(getClientIp(request)).toBe("unknown");
	});
});

describe("enforceRateLimit", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("returns null when the rate limit check passes", async () => {
		checkRateLimit.mockResolvedValue(undefined);
		const request = { headers: new Headers() };
		await expect(enforceRateLimit(request, { limit: 5 })).resolves.toBeNull();
	});

	it("returns a 429 response when the rate limit is exceeded", async () => {
		checkRateLimit.mockRejectedValue("RATE_LIMIT_EXCEEDED");
		const request = { headers: new Headers() };
		const response = await enforceRateLimit(request, { limit: 5 });
		expect(response.status).toBe(429);
	});

	it("rethrows unexpected errors", async () => {
		checkRateLimit.mockRejectedValue(new Error("db down"));
		const request = { headers: new Headers() };
		await expect(enforceRateLimit(request, {})).rejects.toThrow("db down");
	});
});

describe("timingSafeEqual", () => {
	it("returns true for equal strings", () => {
		expect(timingSafeEqual("secret", "secret")).toBe(true);
	});

	it("returns false for different strings of the same length", () => {
		expect(timingSafeEqual("secret", "secreT")).toBe(false);
	});

	it("returns false for different length strings", () => {
		expect(timingSafeEqual("short", "muchlonger")).toBe(false);
	});

	it("returns false when either input is not a string", () => {
		expect(timingSafeEqual(null, "secret")).toBe(false);
		expect(timingSafeEqual("secret", undefined)).toBe(false);
	});
});

describe("getApiToken", () => {
	it("derives a stable token from the user id and hash", () => {
		const user = { id: "user", hash: "h1" };
		const first = getApiToken(user);
		const second = getApiToken(user);
		expect(first).toBe(second);
		expect(first).toMatch(/^[a-f0-9]{64}$/);
	});

	it("produces a different token for a different user", () => {
		const tokenA = getApiToken({ id: "user-a", hash: "h1" });
		const tokenB = getApiToken({ id: "user-b", hash: "h1" });
		expect(tokenA).not.toBe(tokenB);
	});
});

describe("authenticateTokenRequest", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		__clearAuthCacheForTests();
	});

	function paramsOf(entries) {
		return new URLSearchParams(entries);
	}

	it("returns null when id or token is missing", async () => {
		await expect(
			authenticateTokenRequest(paramsOf({ id: "user" })),
		).resolves.toBeNull();
		await expect(
			authenticateTokenRequest(paramsOf({ token: "abc" })),
		).resolves.toBeNull();
		expect(findRecord).not.toHaveBeenCalled();
	});

	it("returns the user when the token matches and the role is not visitor", async () => {
		const user = { id: "user", hash: "h1", role: "student" };
		const token = getApiToken(user);
		findRecord.mockResolvedValue(user);

		await expect(
			authenticateTokenRequest(paramsOf({ id: "USER", token })),
		).resolves.toEqual(user);
		expect(findRecord).toHaveBeenCalledWith({
			collectionName: "users",
			query: { id: "user" },
			fields: { id: 1, hash: 1, role: 1 },
		});
	});

	it("returns null when the user role is visitor", async () => {
		const user = { id: "user", hash: "h1", role: "visitor" };
		const token = getApiToken(user);
		findRecord.mockResolvedValue(user);

		await expect(
			authenticateTokenRequest(paramsOf({ id: "user", token })),
		).resolves.toBeNull();
	});

	it("returns null when the token does not match", async () => {
		findRecord.mockResolvedValue({ id: "user", hash: "h1", role: "student" });
		await expect(
			authenticateTokenRequest(paramsOf({ id: "user", token: "wrong" })),
		).resolves.toBeNull();
	});

	it("returns null when the user does not exist", async () => {
		findRecord.mockResolvedValue(null);
		await expect(
			authenticateTokenRequest(paramsOf({ id: "missing", token: "abc" })),
		).resolves.toBeNull();
	});

	it("caches the authentication result for repeated calls", async () => {
		const user = { id: "user", hash: "h1", role: "student" };
		const token = getApiToken(user);
		findRecord.mockResolvedValue(user);

		await authenticateTokenRequest(paramsOf({ id: "user", token }));
		await authenticateTokenRequest(paramsOf({ id: "user", token }));

		expect(findRecord).toHaveBeenCalledTimes(1);
	});
});

describe("getPositiveInt", () => {
	it("parses a valid positive integer within the max", () => {
		expect(getPositiveInt("10", 5, 100)).toBe(10);
	});

	it("falls back when the value is not a positive number", () => {
		expect(getPositiveInt("-5", 5, 100)).toBe(5);
		expect(getPositiveInt("abc", 5, 100)).toBe(5);
		expect(getPositiveInt(undefined, 5, 100)).toBe(5);
	});

	it("clamps to the maximum", () => {
		expect(getPositiveInt("500", 5, 100)).toBe(100);
	});
});

describe("getNonNegativeInt", () => {
	it("parses a valid non-negative integer", () => {
		expect(getNonNegativeInt("0")).toBe(0);
		expect(getNonNegativeInt("42", 5)).toBe(42);
	});

	it("falls back to the default for invalid values", () => {
		expect(getNonNegativeInt("-1", 3)).toBe(3);
		expect(getNonNegativeInt("abc", 3)).toBe(3);
		expect(getNonNegativeInt(undefined)).toBe(0);
	});
});
