import { authenticateTokenRequest } from "@util/api/api";
import { unstable_cache } from "next/cache";
import { POST } from "./route";

jest.mock("@util/api/api", () => ({
	authenticateTokenRequest: jest.fn(),
}));

jest.mock("next/cache", () => ({
	unstable_cache: jest.fn((callback) => callback),
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
			return new TestResponse(JSON.stringify(body), init);
		}
	}

	return { NextResponse: TestResponse };
});

function makeRequest({ internalKey, body }) {
	return {
		headers: {
			get: (name) => (name === "x-internal-key" ? (internalKey ?? null) : null),
		},
		json: async () => body,
	};
}

describe("POST /api/rss/verify", () => {
	const originalSecret = process.env.AWS_SECRET;

	beforeEach(() => {
		jest.clearAllMocks();
		process.env.AWS_SECRET = "internal-secret";
	});

	afterAll(() => {
		process.env.AWS_SECRET = originalSecret;
	});

	it("caches token verification by id and a token digest", async () => {
		authenticateTokenRequest.mockResolvedValue({ id: "user-1" });
		const response = await POST(
			makeRequest({
				internalKey: "internal-secret",
				body: { id: "user-1", token: "raw-token" },
			}),
		);

		expect(await response.json()).toEqual({ ok: true });
		expect(response.headers.get("Cache-Control")).toBe("no-store");
		expect(unstable_cache).toHaveBeenCalledWith(
			expect.any(Function),
			["rss-auth", "user-1", expect.stringMatching(/^[a-f0-9]{64}$/)],
			{ revalidate: 60 },
		);
		expect(unstable_cache.mock.calls[0][1]).not.toContain("raw-token");
		expect(authenticateTokenRequest).toHaveBeenCalledWith(
			new URLSearchParams({ id: "user-1", token: "raw-token" }),
		);
	});

	it("rejects calls without the internal key before using the cache", async () => {
		const response = await POST(
			makeRequest({ body: { id: "user-1", token: "raw-token" } }),
		);

		expect(response.status).toBe(403);
		expect(response.headers.get("Cache-Control")).toBe("no-store");
		expect(unstable_cache).not.toHaveBeenCalled();
	});

	it("returns ok false when id or token is missing", async () => {
		const response = await POST(
			makeRequest({
				internalKey: "internal-secret",
				body: { id: "user-1" },
			}),
		);

		expect(await response.json()).toEqual({ ok: false });
		expect(authenticateTokenRequest).not.toHaveBeenCalled();
	});

	it("returns ok false when token verification fails", async () => {
		authenticateTokenRequest.mockResolvedValue(false);

		const response = await POST(
			makeRequest({
				internalKey: "internal-secret",
				body: { id: "user-1", token: "bad-token" },
			}),
		);

		expect(await response.json()).toEqual({ ok: false });
	});

	it("returns ok false for unexpected verification errors", async () => {
		authenticateTokenRequest.mockRejectedValue(new Error("db down"));

		const response = await POST(
			makeRequest({
				internalKey: "internal-secret",
				body: { id: "user-1", token: "raw-token" },
			}),
		);

		expect(await response.json()).toEqual({ ok: false });
	});
});
