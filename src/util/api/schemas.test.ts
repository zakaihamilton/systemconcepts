import { internalRateLimitRequestSchema, loginRequestSchema } from "./schemas";

describe("API request schemas", () => {
	it("rejects unknown login fields", () => {
		expect(
			loginRequestSchema.safeParse({ action: "login", unexpected: true })
				.success,
		).toBe(false);
	});

	it("bounds internal rate-limit values", () => {
		expect(
			internalRateLimitRequestSchema.safeParse({ ip: "203.0.113.7", limit: 61 })
				.success,
		).toBe(true);
		expect(
			internalRateLimitRequestSchema.safeParse({ ip: "203.0.113.7", limit: 0 })
				.success,
		).toBe(false);
	});
});
