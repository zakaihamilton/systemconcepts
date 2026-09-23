import { assertSameOrigin, getTrustedClientIp } from "./requestSecurity";

describe("getTrustedClientIp", () => {
	it("prefers an explicitly resolved IP", () => {
		expect(
			getTrustedClientIp({
				ip: "203.0.113.7",
				headers: new Headers({ "x-vercel-forwarded-for": "198.51.100.4" }),
			}),
		).toBe("203.0.113.7");
	});

	it("uses the platform-provided header and otherwise stays unknown", () => {
		expect(
			getTrustedClientIp({
				headers: new Headers({ "x-vercel-forwarded-for": "198.51.100.4" }),
			}),
		).toBe("198.51.100.4");
		expect(getTrustedClientIp({ headers: new Headers() })).toBe("unknown");
		expect(getTrustedClientIp()).toBe("unknown");
	});
});

describe("assertSameOrigin", () => {
	const originalNodeEnv = process.env.NODE_ENV;

	afterEach(() => {
		Reflect.set(process.env, "NODE_ENV", originalNodeEnv);
	});

	it("skips origin validation in tests", () => {
		expect(() =>
			assertSameOrigin({
				url: "http://localhost/api",
				headers: { get: () => null },
			}),
		).not.toThrow();
	});

	it("accepts a matching origin outside test mode", () => {
		Reflect.set(process.env, "NODE_ENV", "production");

		expect(() =>
			assertSameOrigin({
				url: "http://localhost/api",
				headers: { get: () => "http://localhost" },
			}),
		).not.toThrow();
	});

	it("rejects missing and mismatched origins outside test mode", () => {
		Reflect.set(process.env, "NODE_ENV", "production");

		const request = (origin: any) => ({
			url: "http://localhost/api",
			headers: { get: () => origin },
		});

		expect(() => assertSameOrigin(request(null))).toThrow("INVALID_ORIGIN");
		expect(() => assertSameOrigin(request("https://attacker.example"))).toThrow(
			"INVALID_ORIGIN",
		);
	});
});
