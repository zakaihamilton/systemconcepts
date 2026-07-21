import { findArticleByReference } from "./referenceUtils";

const tags = [
	{
		_id: "book-a-inner-ref-ch9",
		book: "Book A",
		section: "Inner Reflection",
		chapter: "Chapter Nine",
		part: "Part 1",
	},
	{
		_id: "book-a-inner-ref-ch3",
		book: "Book A",
		section: "Inner Reflection",
		chapter: "Chapter Three",
		part: "Part 1",
	},
	{
		_id: "book-b-inner-ref-ch9",
		book: "Book B",
		section: "Inner Reflection",
		chapter: "Chapter Nine",
	},
	{
		_id: "book-a-outer-ch2",
		book: "Book A",
		section: "Outer Work",
		chapter: "Chapter Two",
	},
];

describe("findArticleByReference", () => {
	it("matches section and word chapter name", () => {
		const result = findArticleByReference(tags, "Inner Reflection", "Nine", {
			book: "Book A",
			section: "Inner Reflection",
			part: "Part 1",
		});
		expect(result?._id).toBe("book-a-inner-ref-ch9");
	});

	it("matches numeric chapter when tag uses word form", () => {
		const result = findArticleByReference(tags, "Inner Reflection", "3", {
			book: "Book A",
			section: "Inner Reflection",
			part: "Part 1",
		});
		expect(result?._id).toBe("book-a-inner-ref-ch3");
	});

	it("defaults to current section when section name is omitted", () => {
		const result = findArticleByReference(tags, null, "Nine", {
			book: "Book A",
			section: "Inner Reflection",
			part: "Part 1",
		});
		expect(result?._id).toBe("book-a-inner-ref-ch9");
	});

	it("rejects matches from a different book", () => {
		const result = findArticleByReference(tags, "Inner Reflection", "Nine", {
			book: "Book A",
			section: "Inner Reflection",
		});
		expect(result?._id).toBe("book-a-inner-ref-ch9");
		expect(
			findArticleByReference(tags, "Inner Reflection", "Nine", {
				book: "Book C",
				section: "Inner Reflection",
			}),
		).toBeUndefined();
	});

	it("returns null when section does not match", () => {
		const result = findArticleByReference(tags, "Inner Reflection", "Two", {
			book: "Book A",
			section: "Inner Reflection",
		});
		expect(result).toBeUndefined();
	});

	it("returns null for invalid tag lists", () => {
		expect(findArticleByReference(null, "Inner Reflection", "Nine", {})).toBe(
			null,
		);
		expect(
			findArticleByReference(undefined, "Inner Reflection", "Nine", {}),
		).toBe(null);
	});
});
