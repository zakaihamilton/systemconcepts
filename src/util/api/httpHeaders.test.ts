import { JSON_HEADERS, NO_CACHE_HEADERS } from "./httpHeaders";

describe("JSON_HEADERS", () => {
	it("sets the content type to JSON", () => {
		expect(JSON_HEADERS).toEqual({
			"Content-Type": "application/json; charset=utf-8",
		});
	});
});

describe("NO_CACHE_HEADERS", () => {
	it("sets headers that disable caching", () => {
		expect(NO_CACHE_HEADERS).toEqual({
			"Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
			Pragma: "no-cache",
			Expires: "0",
		});
	});
});
