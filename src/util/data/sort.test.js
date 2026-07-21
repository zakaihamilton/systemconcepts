import { descendingComparator, getComparator, stableSort } from "./sort";

describe("descendingComparator", () => {
	it("compares non-negative numbers using subtraction", () => {
		expect(descendingComparator({ v: 5 }, { v: 3 }, "v")).toBeGreaterThan(0);
		expect(descendingComparator({ v: 3 }, { v: 5 }, "v")).toBeLessThan(0);
		expect(descendingComparator({ v: 3 }, { v: 3 }, "v")).toBe(0);
	});

	it("falls back to string comparison for negative numbers", () => {
		expect(descendingComparator({ v: -1 }, { v: 2 }, "v")).not.toBe(-3);
	});

	it("compares strings using the locale-aware collator", () => {
		expect(descendingComparator({ v: "b" }, { v: "a" }, "v")).toBeGreaterThan(
			0,
		);
		expect(descendingComparator({ v: "a" }, { v: "b" }, "v")).toBeLessThan(0);
	});

	it("compares numbered strings numerically", () => {
		expect(
			descendingComparator({ v: "10. Later" }, { v: "2. Middle" }, "v"),
		).toBeGreaterThan(0);
		expect(
			descendingComparator({ v: "2. Middle" }, { v: "10. Later" }, "v"),
		).toBeLessThan(0);
	});

	it("treats missing values as empty strings", () => {
		expect(descendingComparator({}, {}, "v")).toBe(0);
		expect(descendingComparator(null, { v: "a" }, "v")).toBeLessThan(0);
	});
});

describe("getComparator", () => {
	it("returns the descendingComparator itself when order is desc", () => {
		const comparator = getComparator("desc", "v");
		expect(comparator({ v: 1 }, { v: 2 })).toBeLessThan(0);
	});

	it("returns the negated comparator for any other order", () => {
		const comparator = getComparator("asc", "v");
		expect(comparator({ v: 1 }, { v: 2 })).toBeGreaterThan(0);
	});
});

describe("stableSort", () => {
	it("sorts the array without mutating the original", () => {
		const array = [{ v: 3 }, { v: 1 }, { v: 2 }];
		const result = stableSort(array, getComparator("desc", "v"));
		expect(result.map((item) => item.v)).toEqual([1, 2, 3]);
		expect(array.map((item) => item.v)).toEqual([3, 1, 2]);
	});

	it("sorts using the negated comparator for the 'asc' order", () => {
		const array = [{ v: 3 }, { v: 1 }, { v: 2 }];
		const result = stableSort(array, getComparator("asc", "v"));
		expect(result.map((item) => item.v)).toEqual([3, 2, 1]);
	});

	it("preserves the relative order of equal elements", () => {
		const array = [
			{ v: 1, id: "a" },
			{ v: 1, id: "b" },
			{ v: 0, id: "c" },
		];
		const result = stableSort(array, getComparator("desc", "v"));
		expect(result.map((item) => item.id)).toEqual(["c", "a", "b"]);
	});
});
