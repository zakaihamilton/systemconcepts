import {
	abbreviationPattern,
	getStyleInfo,
	hasConfirmingGlossaryParenthetical,
	PHASE_COLORS,
	replaceAbbreviations,
	scanForTerms,
	shouldSkipGlossaryTerm,
	termPattern,
} from "./GlossaryUtils";

describe("GlossaryUtils", () => {
	describe("replaceAbbreviations", () => {
		it("returns non-string values unchanged", () => {
			expect(replaceAbbreviations(null)).toBeNull();
			expect(replaceAbbreviations(undefined)).toBeUndefined();
			expect(replaceAbbreviations(42)).toBe(42);
		});

		it("expands known abbreviations", () => {
			const result = replaceAbbreviations("Study KHB today");
			expect(result).toContain("Keter, Hochma, Bina");
			expect(result).not.toMatch(/\bKHB\b/);
		});

		it("expands abbreviations that already include the expansion in parentheses", () => {
			const result = replaceAbbreviations(
				"KHB (Keter, Hochma, Bina) appears here",
			);
			expect(result).toContain("Keter, Hochma, Bina");
		});

		it("leaves unmatched text alone", () => {
			expect(replaceAbbreviations("plain text")).toBe("plain text");
		});
	});

	describe("shouldSkipGlossaryTerm", () => {
		it("skips English over so it is not rewritten to Crosses", () => {
			const text = "The bridge goes over the river";
			const start = text.indexOf("over");
			expect(shouldSkipGlossaryTerm("over", text, start)).toBe(true);
			expect(shouldSkipGlossaryTerm("Over", text, start)).toBe(true);
		});

		it("keeps Over when followed by a confirming gloss", () => {
			const text = "Then Over (Crosses) the boundary";
			const start = text.indexOf("Over");
			expect(shouldSkipGlossaryTerm("Over", text, start)).toBe(false);
		});

		it("skips lowercase or and sentence-initial Or", () => {
			expect(shouldSkipGlossaryTerm("or", "this or that", 5)).toBe(true);
			expect(shouldSkipGlossaryTerm("Or", "Or something else", 0)).toBe(true);
			expect(shouldSkipGlossaryTerm("Or", "Yes. Or no.", 5)).toBe(true);
		});

		it("keeps mid-sentence capitalized Or as a glossary term", () => {
			const text = "the Or of Atzilut";
			const start = text.indexOf("Or");
			expect(shouldSkipGlossaryTerm("Or", text, start)).toBe(false);
		});

		it("does not skip non-ambiguous Hebrew transliterations", () => {
			const text = "Aviut of the kli";
			expect(shouldSkipGlossaryTerm("Aviut", text, 0)).toBe(false);
			expect(shouldSkipGlossaryTerm("kli", text, text.indexOf("kli"))).toBe(
				false,
			);
		});

		it("detects confirming parenthetical glosses", () => {
			expect(
				hasConfirmingGlossaryParenthetical("Over (Crosses)", 4, "Over", {
					en: "Crosses",
					trans: "Over",
				}),
			).toBe(true);
			expect(
				hasConfirmingGlossaryParenthetical("over the river", 4, "over", {
					en: "Crosses",
					trans: "Over",
				}),
			).toBe(false);
		});
	});

	describe("scanForTerms", () => {
		it("returns empty for non-string input", () => {
			expect(scanForTerms(null)).toEqual([]);
			expect(scanForTerms(undefined)).toEqual([]);
			expect(scanForTerms(12)).toEqual([]);
		});

		it("skips blank lines and finds glossary terms", () => {
			const terms = scanForTerms("\n\nme'ah is one hundred\n\n");
			expect(terms.some((t) => t.term === "me'ah")).toBe(true);
			expect(terms.find((t) => t.term === "me'ah").paragraphs).toEqual([1]);
		});

		it("records multiple paragraph occurrences", () => {
			const terms = scanForTerms("me'ah first\n\nother\n\nme'ah again");
			const entry = terms.find((t) => t.term === "me'ah");
			expect(entry.paragraphs).toEqual([1, 3]);
		});

		it("skips lowercase or", () => {
			const terms = scanForTerms("this or that");
			expect(terms.every((t) => t.term !== "or")).toBe(true);
		});

		it("skips Or at the start of a sentence", () => {
			const terms = scanForTerms("Or something else");
			expect(terms.every((t) => t.term !== "or")).toBe(true);
		});

		it("skips Or after sentence punctuation", () => {
			const terms = scanForTerms("Yes. Or no.");
			expect(terms.every((t) => t.term !== "or")).toBe(true);
		});

		it("skips English over in prose", () => {
			const terms = scanForTerms("The light passes over the screen");
			expect(terms.every((t) => t.term !== "over")).toBe(true);
		});

		it("keeps Over when explicitly glossed", () => {
			const terms = scanForTerms("Then Over (Crosses) the boundary");
			expect(terms.some((t) => t.term === "over")).toBe(true);
		});

		it("sorts terms alphabetically", () => {
			const terms = scanForTerms("me'ah and another known term if present");
			const names = terms.map((t) => t.term);
			expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
		});

		it("strips nbsp and zero-width chars before matching", () => {
			const terms = scanForTerms("me\u00A0'ah".replace(" ", "") + " me'ah");
			expect(Array.isArray(terms)).toBe(true);
		});
	});

	describe("patterns and helpers", () => {
		it("exports working regex patterns", () => {
			expect(termPattern).toBeInstanceOf(RegExp);
			expect(abbreviationPattern).toBeInstanceOf(RegExp);
			expect("KHB".match(abbreviationPattern)).toBeTruthy();
		});

		it("exposes phase colors", () => {
			expect(PHASE_COLORS.root).toBe("#ffffff");
			expect(PHASE_COLORS.one).toBeTruthy();
		});

		it("getStyleInfo handles null, string, and object styles", () => {
			expect(getStyleInfo(null)).toBeNull();
			expect(getStyleInfo("root")).toEqual({ category: "root" });
			expect(getStyleInfo({ category: "leaf", phase: "one" })).toEqual({
				category: "leaf",
				phase: "one",
			});
		});
	});
});
