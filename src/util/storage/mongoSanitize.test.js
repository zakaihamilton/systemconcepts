import { sanitizeQuery } from "@util/storage/mongoSanitize";

describe("sanitizeQuery", () => {
	it("returns falsy queries unchanged", () => {
		expect(sanitizeQuery(null)).toBe(null);
		expect(sanitizeQuery(undefined)).toBe(undefined);
		expect(sanitizeQuery("")).toBe("");
		expect(sanitizeQuery(0)).toBe(0);
	});

	it("returns non-object queries unchanged", () => {
		expect(sanitizeQuery("id-123")).toBe("id-123");
		expect(sanitizeQuery(42)).toBe(42);
	});

	it("allows plain queries without operators", () => {
		const query = { id: "abc", nested: { name: "foo" } };
		expect(sanitizeQuery(query)).toBe(query);
	});

	it("allows safe query operators", () => {
		const query = { id: { $in: ["a", "b"] } };
		expect(sanitizeQuery(query)).toBe(query);
	});

	it.each([
		"$where",
		"$function",
		"$accumulator",
		"$regex",
		"$expr",
		"$jsonSchema",
	])("throws for the dangerous operator %s", (operator) => {
		expect(() => sanitizeQuery({ [operator]: "value" })).toThrow(
			`Invalid query operator: ${operator}`,
		);
	});

	it("detects dangerous operators regardless of casing", () => {
		expect(() => sanitizeQuery({ $WHERE: "value" })).toThrow(
			"Invalid query operator: $WHERE",
		);
	});

	it("recursively sanitizes nested objects", () => {
		expect(() =>
			sanitizeQuery({ id: "abc", nested: { $where: "1==1" } }),
		).toThrow("Invalid query operator: $where");
	});

	it("recursively sanitizes array items", () => {
		expect(() => sanitizeQuery([{ id: "a" }, { $where: "1==1" }])).toThrow(
			"Invalid query operator: $where",
		);
	});

	it("ignores null nested values", () => {
		const query = { id: "abc", nested: null };
		expect(sanitizeQuery(query)).toBe(query);
	});
});
