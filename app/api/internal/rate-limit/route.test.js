import { checkRateLimit } from "@util/auth/rateLimit";
import { unstable_cache } from "next/cache";
import { POST } from "./route";

jest.mock("@util/auth/rateLimit", () => ({ checkRateLimit: jest.fn() }));
jest.mock("next/cache", () => ({
	unstable_cache: jest.fn((callback) => callback),
}));
jest.mock("next/server", () => {
	class TestResponse {
		constructor(body, init = {}) {
			this.body = body;
			this.status = init.status || 200;
			this.headers = new Map(
				Object.entries(init.headers || {}).map(([key, value]) => [
					key.toLowerCase(),
					value,
				]),
			);
		}

		async json() {
			return JSON.parse(this.body);
		}

		static json(body, init = {}) {
			return new TestResponse(JSON.stringify(body), init);
		}
	}

	return { NextResponse: TestResponse };
});

function request(body, internalKey = "internal-secret") {
	return {
		headers: {
			get: (name) => (name === "x-internal-key" ? internalKey : null),
		},
		json: async () => body,
	};
}

describe("POST /api/internal/rate-limit", () => {
	const originalSecret = process.env.AWS_SECRET;

	beforeEach(() => {
		jest.clearAllMocks();
		process.env.AWS_SECRET = "internal-secret";
	});

	afterAll(() => {
		process.env.AWS_SECRET = originalSecret;
	});

	it("caches rate-limit checks using a hashed IP key", async () => {
		checkRateLimit.mockResolvedValue();
		const response = await POST(
			request({ ip: "203.0.113.8", limit: 60, windowMs: 60000 }),
		);

		expect(await response.json()).toEqual({ ok: true });
		expect(unstable_cache).toHaveBeenCalledWith(
			expect.any(Function),
			["rate-limit", expect.stringMatching(/^[a-f0-9]{64}$/), "60", "60000"],
			{ revalidate: 5 },
		);
		expect(unstable_cache.mock.calls[0][1]).not.toContain("203.0.113.8");
		expect(checkRateLimit).toHaveBeenCalledWith(
			{ ip: "203.0.113.8" },
			{ limit: 60, windowMs: 60000, key: "203.0.113.8" },
		);
	});

	it("preserves rate-limit denials", async () => {
		checkRateLimit.mockRejectedValue("RATE_LIMIT_EXCEEDED");

		const response = await POST(request({ ip: "203.0.113.8" }));

		expect(await response.json()).toEqual({ ok: false });
	});

	it("rejects requests with a missing or invalid internal key", async () => {
		const response = await POST(request({ ip: "203.0.113.8" }, "wrong-key"));

		expect(response.status).toBe(403);
		expect(checkRateLimit).not.toHaveBeenCalled();
	});

	it("rejects malformed request bodies", async () => {
		const response = await POST(request({}));

		expect(await response.json()).toEqual({ ok: false });
		expect(checkRateLimit).not.toHaveBeenCalled();
	});

	it("returns ok false for unexpected rate-limit errors", async () => {
		checkRateLimit.mockRejectedValue(new Error("database unavailable"));

		const response = await POST(request({ ip: "203.0.113.8" }));

		expect(await response.json()).toEqual({ ok: false });
	});
});
