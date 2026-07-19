import { filterResearchResults } from "./searchFilters";

const translations = {
	SESSIONS: "Sessions",
	ARTICLES: "Articles",
	SUMMARIES: "Summaries",
	TRANSCRIPTIONS: "Transcriptions",
};

describe("research filters", () => {
	it("filters session sources and group names", () => {
		const results = [
			{ isSession: true, group: "ai" },
			{ isSession: false, tag: { group: "ai" } },
		];
		expect(
			filterResearchResults(
				results,
				[
					{ type: "source", label: "Sessions" },
					{ type: "group", label: "AI" },
				],
				translations,
			),
		).toEqual([results[0]]);
	});

	it("uses OR within one filter category and AND across categories", () => {
		const results = [
			{ isSession: true, group: "ai", year: "2024" },
			{ isSession: true, group: "study", year: "2024" },
			{ isSession: true, group: "ai", year: "2023" },
		];
		expect(
			filterResearchResults(
				results,
				[
					{ type: "group", label: "AI" },
					{ type: "group", label: "Study" },
					{ type: "year", label: "2024" },
				],
				translations,
			),
		).toEqual([results[0], results[1]]);
	});
});
