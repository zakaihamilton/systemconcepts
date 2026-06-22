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
});
