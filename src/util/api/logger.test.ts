import {
	debug,
	error,
	errorLog,
	format,
	handle,
	info,
	log,
	logger,
	redact,
	shouldLog,
	warn,
} from "@util/api/logger";

describe("structured logger", () => {
	const originalEnv = process.env;

	beforeEach(() => {
		process.env = { ...originalEnv, LOG_LEVEL: "debug", NODE_ENV: "test" };
		delete process.env.NEXT_PUBLIC_LOG_LEVEL;
	});

	afterEach(() => {
		process.env = originalEnv;
		jest.restoreAllMocks();
	});

	it("redacts nested sensitive fields and serializes errors", () => {
		const cause = new Error("root");
		const err = new Error("broken");
		err.cause = cause;
		const circular = { a: 1 };
		circular.self = circular;
		const result = redact({
			token: "secret",
			api_key: "k",
			nested: { password: "password", error: err, list: [1, { secret: "x" }] },
			circular,
		});
		expect(result.token).toBe("[REDACTED]");
		expect(result.api_key).toBe("[REDACTED]");
		expect(result.nested.password).toBe("[REDACTED]");
		expect(result.nested.error).toEqual(
			expect.objectContaining({
				name: "Error",
				message: "broken",
				cause: expect.objectContaining({ message: "root" }),
			}),
		);
		expect(result.nested.list[1].secret).toBe("[REDACTED]");
		expect(result.circular.self).toBe("[Circular]");
	});

	it("filters messages below the configured threshold", () => {
		process.env.LOG_LEVEL = "warn";
		expect(shouldLog("debug")).toBe(false);
		expect(shouldLog("warn")).toBe(true);
	});

	it("defaults to warn in production when LOG_LEVEL is unset", () => {
		delete process.env.LOG_LEVEL;
		delete process.env.NEXT_PUBLIC_LOG_LEVEL;
		process.env.NODE_ENV = "production";
		jest.resetModules();
		const { shouldLog: shouldLogFresh } = require("@util/api/logger");
		expect(shouldLogFresh("debug")).toBe(false);
		expect(shouldLogFresh("warn")).toBe(true);
	});

	it("defaults to debug outside production when LOG_LEVEL is unset", () => {
		delete process.env.LOG_LEVEL;
		delete process.env.NEXT_PUBLIC_LOG_LEVEL;
		process.env.NODE_ENV = "development";
		jest.resetModules();
		const { shouldLog: shouldLogFresh } = require("@util/api/logger");
		expect(shouldLogFresh("debug")).toBe(true);
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

	it("writes debug/info/warn via console methods", () => {
		const debugSpy = jest.spyOn(console, "debug").mockImplementation(() => {});
		const infoSpy = jest.spyOn(console, "info").mockImplementation(() => {});
		const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
		debug("d", { a: 1 });
		info("i");
		warn("w", { b: 2 }, "extra");
		expect(debugSpy).toHaveBeenCalledWith(
			expect.objectContaining({ level: "debug", message: "d" }),
		);
		expect(infoSpy).toHaveBeenCalledWith(
			expect.objectContaining({ level: "info", message: "i" }),
		);
		expect(warnSpy).toHaveBeenCalledWith(
			expect.objectContaining({
				level: "warn",
				message: "w",
				context: expect.objectContaining({ value: { b: 2 }, extra: ["extra"] }),
			}),
		);
	});

	it("normalizes non-string messages and omits empty context", () => {
		const spy = jest.spyOn(console, "info").mockImplementation(() => {});
		info({ code: 42 });
		expect(spy).toHaveBeenCalledWith(
			expect.objectContaining({
				message: "Application diagnostic",
				context: { value: { code: 42 } },
			}),
		);
		info("plain");
		expect(spy).toHaveBeenCalledWith(
			expect.objectContaining({
				message: "plain",
			}),
		);
		const last = spy.mock.calls.at(-1)[0];
		expect(last.context).toBeUndefined();
	});

	it("formats legacy log lines and redacts props", () => {
		const lines = format({
			date: "Mon",
			utc: 123,
			component: "Sync",
			type: "info",
			token: "secret",
			ok: true,
		});
		expect(lines).toEqual(
			expect.arrayContaining([
				123,
				" - ",
				"Mon",
				"Component: ",
				"Sync",
				"Type: ",
				"info",
			]),
		);
		expect(lines).toContain("token");
		expect(lines).toContain("[REDACTED]");
	});

	it("supports legacy log/error/handle helpers", () => {
		const infoSpy = jest.spyOn(console, "info").mockImplementation(() => {});
		const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
		log({ component: "Comp", detail: 1 });
		expect(infoSpy).toHaveBeenCalledWith(
			expect.objectContaining({ message: "Comp" }),
		);
		log();
		expect(infoSpy).toHaveBeenCalledWith(
			expect.objectContaining({ message: "application" }),
		);
		expect(() => error({ component: "Boom", throwError: true })).toThrow(
			expect.objectContaining({ component: "Boom" }),
		);
		error({ component: "Soft", throwError: false });
		expect(errorSpy).toHaveBeenCalled();
		handle({ type: "log", props: { component: "H" } });
		expect(() =>
			handle({ type: "error", props: { component: "E" } }),
		).toThrow();
		handle();
	});

	it("exports errorLog alias used by logger.error", () => {
		const spy = jest.spyOn(console, "error").mockImplementation(() => {});
		errorLog("direct");
		expect(spy).toHaveBeenCalledWith(
			expect.objectContaining({ level: "error", message: "direct" }),
		);
	});

	it("respects NEXT_PUBLIC_LOG_LEVEL in browser environments", () => {
		const originalWindow = global.window;
		global.window = {};
		delete process.env.LOG_LEVEL;
		process.env.NEXT_PUBLIC_LOG_LEVEL = "error";
		process.env.NODE_ENV = "development";
		jest.resetModules();
		const { shouldLog: browserShouldLog } = require("@util/api/logger");
		expect(browserShouldLog("warn")).toBe(false);
		expect(browserShouldLog("error")).toBe(true);
		global.window = originalWindow;
		jest.resetModules();
	});

	it("skips debug output when the level is below the threshold", () => {
		process.env.LOG_LEVEL = "error";
		const spy = jest.spyOn(console, "debug").mockImplementation(() => {});
		debug("hidden");
		expect(spy).not.toHaveBeenCalled();
	});
});
