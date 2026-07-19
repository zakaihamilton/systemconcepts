import {
	clauseMatchesText,
	getResearchSuggestions,
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
});
