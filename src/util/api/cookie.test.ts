import parseCookie from "./cookie";

describe("parseCookie", () => {
	it("returns an empty object when there is no cookie header", () => {
		expect(parseCookie(undefined)).toEqual({});
		expect(parseCookie(null)).toEqual({});
		expect(parseCookie("")).toEqual({});
	});

	it("parses a single cookie", () => {
		expect(parseCookie("name=value")).toEqual({ name: "value" });
	});

	it("parses multiple cookies separated by semicolons", () => {
		expect(parseCookie("a=1; b=2; c=3")).toEqual({ a: "1", b: "2", c: "3" });
	});

	it("ignores cookies without a value", () => {
		expect(parseCookie("a=1; b=")).toEqual({ a: "1" });
	});

	it("ignores cookies without a name", () => {
		expect(parseCookie("=value; a=1")).toEqual({ a: "1" });
	});

	it("trims whitespace around cookie entries", () => {
		expect(parseCookie("  a=1  ;  b=2  ")).toEqual({ a: "1", b: "2" });
	});
});
