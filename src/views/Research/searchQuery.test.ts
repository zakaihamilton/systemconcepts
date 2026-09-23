import {
	clauseMatchesText,
	getResearchSuggestions,
	getSearchTerms,
	parseResearchQuery,
	rankResearchResults,
} from "./searchQuery";

describe("Research query utilities", () => {
	it("treats ordinary words as all-word matches and preserves quoted phrases", () => {
		const groups = parseResearchQuery('grace hope OR "new life"');
		expect(groups).toEqual([
			[
				{ raw: "grace", terms: ["grace"], phrase: false },
				{ raw: "hope", terms: ["hope"], phrase: false },
			],
			[{ raw: "new life", terms: ["new", "life"], phrase: true }],
		]);
		expect(clauseMatchesText(groups[0][0], "Grace is present")).toBe(true);
		expect(clauseMatchesText(groups[1][0], "A new, life-giving way")).toBe(
			true,
		);
		expect(parseResearchQuery('"faith AND hope"')[0][0].terms).toEqual([
			"faith",
			"and",
			"hope",
		]);
	});

	it("supports Hebrew terms and relevance ranking", () => {
		const clause = parseResearchQuery("אמונה")[0][0];
		expect(clauseMatchesText(clause, "אמונה ותקווה")).toBe(true);
		const ranked = rankResearchResults(
			[
				{ tag: { title: "A note" }, matches: [{}, {}, {}] },
				{ tag: { title: "Grace and hope" }, matches: [{}] },
			],
			"grace hope",
		);
		expect(ranked[0].tag.title).toBe("Grace and hope");
	});

	it("does not match a Latin term inside another word", () => {
		const clause = parseResearchQuery("art")[0][0];
		expect(clauseMatchesText(clause, "A work of art")).toBe(true);
		expect(clauseMatchesText(clause, "A generous heart")).toBe(false);
	});

	it("groups title, metadata, and term suggestions", () => {
		const suggestions = getResearchSuggestions({
			query: "gra",
			titles: ["Grace in practice"],
			filters: [{ type: "group", label: "Grace study" }],
			terms: ["graceful"],
		});
		expect(suggestions.map((suggestion) => suggestion.kind)).toEqual([
			"title",
			"filter",
			"term",
		]);
	});

	it("returns no suggestions for short queries", () => {
		expect(
			getResearchSuggestions({
				query: "g",
				titles: ["Grace"],
				filters: [],
				terms: ["graceful"],
			}),
		).toEqual([]);
	});

	it("deduplicates repeated suggestions", () => {
		const suggestions = getResearchSuggestions({
			query: "grace",
			titles: ["Grace", "Grace"],
			filters: [{ type: "group", label: "Grace" }],
			terms: ["grace"],
		});
		expect(suggestions).toHaveLength(3);
	});

	it("extracts unique search terms from grouped queries", () => {
		expect(getSearchTerms('grace OR "new life"')).toEqual([
			"grace",
			"new",
			"life",
		]);
	});

	it("treats empty clauses as matching any text", () => {
		expect(clauseMatchesText({ terms: [], phrase: false }, "anything")).toBe(
			true,
		);
	});

	it("ranks title phrase matches above incidental term hits", () => {
		const ranked = rankResearchResults(
			[
				{ tag: { title: "A note" }, matches: [{}, {}, {}] },
				{ tag: { title: "Grace and hope" }, matches: [{}] },
			],
			'"Grace and hope"',
		);
		expect(ranked[0].tag.title).toBe("Grace and hope");
	});

	it("escapes regex metacharacters and matches non-latin terms", () => {
		expect(
			clauseMatchesText({ terms: ["a.b"], phrase: false }, "xx a.b yy"),
		).toBe(true);
		expect(
			clauseMatchesText({ terms: ["שלום"], phrase: false }, "שלום עולם"),
		).toBe(true);
	});

	it("matches phrases with punctuation between terms", () => {
		expect(
			clauseMatchesText(
				{ terms: ["new", "life"], phrase: true },
				"new — life begins",
			),
		).toBe(true);
		expect(
			clauseMatchesText(
				{ terms: ["new", "life"], phrase: true },
				"lifetime news",
			),
		).toBe(false);
	});

	it("parseResearchQuery skips empty token groups", () => {
		expect(parseResearchQuery('   OR  ""  OR   ')).toEqual([]);
		expect(parseResearchQuery()).toEqual([]);
	});

	it("supports AND splitting outside quotes", () => {
		expect(parseResearchQuery("grace AND hope")).toEqual([
			[
				{ raw: "grace", terms: ["grace"], phrase: false },
				{ raw: "hope", terms: ["hope"], phrase: false },
			],
		]);
	});

	it("ranks using name fallback and stable title sort", () => {
		const ranked = rankResearchResults(
			[
				{ name: "B title", matches: [] },
				{ name: "A title", matches: [] },
			],
			"",
		);
		expect(ranked.map((r) => r.name)).toEqual(["A title", "B title"]);
	});

	it("returns empty suggestions for empty query", () => {
		expect(getResearchSuggestions({ query: "" })).toEqual([]);
		const suggestions = getResearchSuggestions({
			query: "ab",
			titles: ["ab one", null, "ab one"],
			filters: [{ label: "ab filter" }, { label: "ab filter" }],
			terms: ["ab term", "ab term"],
		});
		expect(suggestions.length).toBeGreaterThan(0);
	});
});
