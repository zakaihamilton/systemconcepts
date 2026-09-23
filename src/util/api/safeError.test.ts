import { getErrorCode, getSafeError } from "@util/api/safeError";

describe("safe API errors", () => {
	it("normalizes legacy strings and structured errors", () => {
		expect(getErrorCode("AUTHENTICATION_REQUIRED")).toBe(
			"AUTHENTICATION_REQUIRED",
		);
		expect(getErrorCode({ code: "NOT_FOUND" })).toBe("NOT_FOUND");
		expect(getErrorCode(new Error("broken"))).toBe("broken");
	});

	it("maps known internal codes to user-safe messages", () => {
		expect(getSafeError({ code: "RATE_LIMIT_EXCEEDED" })).toBe(
			"Too many attempts, please try again later",
		);
	});
});
