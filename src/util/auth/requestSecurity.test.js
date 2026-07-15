import { getTrustedClientIp } from "./requestSecurity";

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
	});
});
