import {
	buildResearchFilterDocFromFileId,
	docMatchesResearchFilters,
	filterResearchResults,
	getAllowedResearchFileIndices,
	sanitizeResearchFilterTags,
} from "./searchFilters";

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

	it("ignores retired Transcriptions source filters", () => {
		const results = [
			{ isSession: true, group: "ai", summaryText: "summary" },
			{ isSession: false, tag: { group: "ai" } },
		];
		expect(
			filterResearchResults(
				results,
				[{ type: "source", label: "Transcriptions", id: "TRANSCRIPTIONS" }],
				translations,
			),
		).toEqual(results);
	});

	it("sanitizeResearchFilterTags strips Transcriptions chips", () => {
		expect(
			sanitizeResearchFilterTags(
				[
					{ type: "source", label: "Sessions", id: "SESSIONS" },
					{ type: "source", label: "Transcriptions", id: "TRANSCRIPTIONS" },
					{ type: "source", label: "Transcrições" },
				],
				translations,
			),
		).toEqual([{ type: "source", label: "Sessions", id: "SESSIONS" }]);
	});

	it("filters article and summary sources", () => {
		const results = [
			{ isSession: false, tag: { title: "Article" } },
			{ isSession: true, summaryText: "A summary" },
			{ isSession: true, summary: "Another summary" },
			{ isSession: true },
		];
		expect(
			filterResearchResults(
				results,
				[{ type: "source", label: "Articles" }],
				translations,
			),
		).toEqual([results[0]]);
		expect(
			filterResearchResults(
				results,
				[{ type: "source", label: "Summaries" }],
				translations,
			),
		).toEqual([results[1], results[2]]);
	});

	it("filters sessions by date and type metadata", () => {
		const results = [
			{
				isSession: true,
				group: "ai",
				year: "2024",
				date: "2024-05-01",
				type: "video",
			},
			{
				isSession: true,
				group: "ai",
				year: "2024",
				date: "2024-06-01",
				type: "audio",
			},
		];
		expect(
			filterResearchResults(
				results,
				[{ type: "date", label: "2024-05-01" }],
				translations,
			),
		).toEqual([results[0]]);
		expect(
			filterResearchResults(
				results,
				[{ type: "type", label: "Audio" }],
				translations,
			),
		).toEqual([results[1]]);
	});

	it("matches article metadata and legacy string filters", () => {
		const results = [
			{ isSession: false, tag: { topic: "Grace", author: "Augustine" } },
			{ isSession: false, tag: { topic: "Hope" } },
		];
		expect(
			filterResearchResults(
				results,
				[{ type: "topic", label: "Grace" }],
				translations,
			),
		).toEqual([results[0]]);
		expect(filterResearchResults(results, ["Augustine"], translations)).toEqual(
			[results[0]],
		);
	});

	it("returns all results when no filters are applied", () => {
		const results = [{ docId: "1" }, { docId: "2" }];
		expect(filterResearchResults(results, [], translations)).toEqual(results);
	});

	it("removes legacy string transcription filters", () => {
		expect(
			sanitizeResearchFilterTags(["תמלולים", "Sessions"], translations),
		).toEqual(["Sessions"]);
	});

	it("filters out sessions that do not match a typed filter", () => {
		const results = [
			{ isSession: true, group: "ai", year: "2024", date: "2024-01-01" },
		];
		expect(
			filterResearchResults(
				results,
				[{ type: "year", label: "2023" }],
				translations,
			),
		).toEqual([]);
	});

	it("matches article metadata through LibraryTagKeys when type is absent", () => {
		const results = [{ isSession: false, tag: { author: "Augustine" } }];
		expect(
			filterResearchResults(results, [{ label: "Augustine" }], translations),
		).toEqual(results);
	});

	it("builds lightweight docs and allowed file indices from metadata", () => {
		const libraryTags = [
			{
				_id: "article-1",
				article: "438, Save Your Servant, You, My God",
			},
			{ _id: "article-2", article: "Other" },
		];
		const sessionId = "session|american|2026|2026-01-01|Grace study";
		const indexData = {
			f: ["article-1", "article-2", sessionId],
		};

		expect(
			buildResearchFilterDocFromFileId("article-1", {
				libraryTagsById: new Map(libraryTags.map((t) => [t._id, t])),
			}),
		).toEqual({
			isSession: false,
			tag: libraryTags[0],
		});

		const allowed = getAllowedResearchFileIndices(
			indexData,
			[{ type: "article", label: "438, Save Your Servant, You, My God" }],
			translations,
			{ libraryTags },
		);
		expect([...allowed]).toEqual([0]);

		expect(
			docMatchesResearchFilters(
				{ isSession: false, tag: libraryTags[0] },
				[{ type: "article", label: "438, Save Your Servant, You, My God" }],
				translations,
			),
		).toBe(true);
	});

	it("keeps summary-unknown sessions as SUMMARIES candidates", () => {
		expect(
			docMatchesResearchFilters(
				{ isSession: true, summaryUnknown: true },
				[{ type: "source", label: "Summaries" }],
				translations,
			),
		).toBe(true);
		expect(
			docMatchesResearchFilters(
				{ isSession: true },
				[{ type: "source", label: "Summaries" }],
				translations,
			),
		).toBe(false);
	});

	it("returns null allowed indices when filters are empty", () => {
		expect(
			getAllowedResearchFileIndices({ f: ["a"] }, [], translations),
		).toBeNull();
	});

	it("builds session docs from ids and rejects malformed session ids", () => {
		const sessionId = "session|g|2024|2024-01-01|Talk";
		const doc = buildResearchFilterDocFromFileId(sessionId, {
			sessionsById: new Map([
				[
					sessionId,
					{
						group: "g",
						year: "2024",
						date: "2024-01-01",
						name: "Talk",
						summaryText: "Notes",
					},
				],
			]),
		});
		expect(doc.isSession).toBe(true);
		expect(doc.summaryUnknown).toBe(false);
		expect(buildResearchFilterDocFromFileId("session|bad")).toBeNull();
		expect(buildResearchFilterDocFromFileId(null)).toBeNull();
	});

	it("resolves library tags from an array when no map is provided", () => {
		const doc = buildResearchFilterDocFromFileId("article-1", {
			libraryTagsById: [{ _id: "article-1", title: "One" }],
		});
		expect(doc.tag.title).toBe("One");
	});

	it("excludes non-matching file indices from allowed sets", () => {
		const allowed = getAllowedResearchFileIndices(
			{ f: ["article-1", "article-2"] },
			[{ type: "source", label: "Articles" }],
			translations,
			{
				libraryTags: [
					{ _id: "article-1", title: "One" },
					{ _id: "article-2", title: "Two" },
				],
			},
		);
		expect([...allowed].sort()).toEqual([0, 1]);
	});
});
