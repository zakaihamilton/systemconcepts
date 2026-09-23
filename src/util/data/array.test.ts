import { nextTrimmedString } from "./array";

describe("nextTrimmedString", () => {
	it("returns the first value when current is not found", () => {
		expect(nextTrimmedString(["a", "b", "c"], "missing")).toBe("a");
	});

	it("returns the next value after the current match", () => {
		expect(nextTrimmedString(["a", "b", "c"], "b")).toBe("c");
	});

	it("wraps around to the first value after the last match", () => {
		expect(nextTrimmedString(["a", "b", "c"], "c")).toBe("a");
	});

	it("matches trimmed string values", () => {
		expect(nextTrimmedString([" a ", "b"], "a")).toBe("b");
	});

	it("ignores non-string values when matching", () => {
		expect(nextTrimmedString([1, "b", "c"], "b")).toBe("c");
	});

	it("throws when values is undefined since there is no first value", () => {
		expect(() => nextTrimmedString(undefined, "anything")).toThrow();
	});

	it("throws when values is null since there is no first value", () => {
		expect(() => nextTrimmedString(null, "anything")).toThrow();
	});
});
