import { logger, redact, shouldLog } from "@util/api/logger";

describe("structured logger", () => {
	const originalEnv = process.env;

	beforeEach(() => {
		process.env = { ...originalEnv, LOG_LEVEL: "debug" };
	});

	afterEach(() => {
		process.env = originalEnv;
		jest.restoreAllMocks();
	});

	it("redacts nested sensitive fields and serializes errors", () => {
		const result = redact({
			token: "secret",
			nested: { password: "password", error: new Error("broken") },
		});
		expect(result.token).toBe("[REDACTED]");
		expect(result.nested.password).toBe("[REDACTED]");
		expect(result.nested.error).toEqual(
			expect.objectContaining({ name: "Error", message: "broken" }),
		);
	});

	it("filters messages below the configured threshold", () => {
		process.env.LOG_LEVEL = "warn";
		expect(shouldLog("debug")).toBe(false);
		expect(shouldLog("warn")).toBe(true);
	});

	it("writes structured records", () => {
		const spy = jest.spyOn(console, "error").mockImplementation(() => {});
		logger.error("Sync failed", { token: "secret" });
		expect(spy).toHaveBeenCalledWith(
			expect.objectContaining({
				level: "error",
				message: "Sync failed",
				context: { token: "[REDACTED]" },
			}),
		);
	});
});
