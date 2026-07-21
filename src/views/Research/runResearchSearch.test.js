import { runResearchSearch } from "./runResearchSearch";

describe("runResearchSearch", () => {
	it("returns empty results without an index", async () => {
		await expect(runResearchSearch({})).resolves.toEqual({
			results: [],
			highlight: [],
		});
	});

	it("supports filter-only searches by selecting every file", async () => {
		const indexData = {
			v: 5,
			f: ["article-1", "article-2"],
			t: {},
		};
		const loadParagraphsForFile = jest
			.fn()
			.mockResolvedValueOnce(["Grace under pressure"])
			.mockResolvedValueOnce(["Other text"]);
		const libraryTags = [
			{ _id: "article-1", title: "One" },
			{ _id: "article-2", title: "Two" },
		];

		const { results, highlight } = await runResearchSearch({
			indexData,
			searchQuery: "",
			libraryTags,
			loadParagraphsForFile,
		});

		expect(highlight).toEqual([]);
		expect(results).toHaveLength(2);
		expect(loadParagraphsForFile).toHaveBeenCalledTimes(2);
	});

	it("loads only files matching filter tags on filter-only search", async () => {
		const indexData = {
			v: 5,
			f: ["article-1", "article-2", "article-3"],
			t: {},
		};
		const loadParagraphsForFile = jest
			.fn()
			.mockResolvedValue(["Matched article body"]);
		const libraryTags = [
			{
				_id: "article-1",
				title: "One",
				article: "438, Save Your Servant, You, My God",
			},
			{ _id: "article-2", title: "Two", article: "Other" },
			{ _id: "article-3", title: "Three", article: "Other" },
		];

		const { results } = await runResearchSearch({
			indexData,
			searchQuery: "",
			libraryTags,
			filterTags: [
				{
					type: "article",
					label: "438, Save Your Servant, You, My God",
				},
			],
			loadParagraphsForFile,
		});

		expect(loadParagraphsForFile).toHaveBeenCalledTimes(1);
		expect(loadParagraphsForFile).toHaveBeenCalledWith(
			"article-1",
			expect.any(Map),
		);
		expect(results).toHaveLength(1);
		expect(results[0].docId).toBe("article-1");
	});

	it("skips paragraph loads for files excluded by filters during text search", async () => {
		const indexData = {
			v: 5,
			f: ["article-1", "article-2"],
			t: {
				grace: [-1, 0, -2, 0],
			},
		};
		const loadParagraphsForFile = jest
			.fn()
			.mockResolvedValue(["Grace under pressure"]);
		const libraryTags = [
			{ _id: "article-1", title: "One", author: "Augustine" },
			{ _id: "article-2", title: "Two", author: "Other" },
		];

		const { results } = await runResearchSearch({
			indexData,
			searchQuery: "grace",
			libraryTags,
			filterTags: [{ type: "author", label: "Augustine" }],
			loadParagraphsForFile,
		});

		expect(loadParagraphsForFile).toHaveBeenCalledTimes(1);
		expect(loadParagraphsForFile).toHaveBeenCalledWith(
			"article-1",
			expect.any(Map),
		);
		expect(results).toHaveLength(1);
		expect(results[0].docId).toBe("article-1");
	});

	it("intersects AND tokens and verifies v5 paragraphs", async () => {
		const indexData = {
			v: 5,
			f: ["article-1"],
			t: {
				grace: [-1, 0],
				under: [-1, 0],
				noise: [-1, 1],
			},
		};
		const loadParagraphsForFile = jest
			.fn()
			.mockResolvedValue(["Grace under pressure", "Unrelated noise"]);
		const libraryTags = [{ _id: "article-1", title: "Grace" }];

		const { results, highlight } = await runResearchSearch({
			indexData,
			searchQuery: "grace AND under",
			libraryTags,
			loadParagraphsForFile,
		});

		expect(highlight).toEqual(["grace", "under"]);
		expect(results).toHaveLength(1);
		expect(results[0].matches[0].text).toBe("Grace under pressure");
		expect(loadParagraphsForFile).toHaveBeenCalledWith(
			"article-1",
			expect.any(Map),
		);
	});

	it("supports OR groups across paragraphs", async () => {
		const indexData = {
			v: 5,
			f: ["article-1"],
			t: {
				alpha: [-1, 0],
				beta: [-1, 1],
			},
		};
		const loadParagraphsForFile = jest
			.fn()
			.mockResolvedValue(["alpha only", "beta only"]);
		const libraryTags = [{ _id: "article-1", title: "Doc" }];

		const { results } = await runResearchSearch({
			indexData,
			searchQuery: "alpha OR beta",
			libraryTags,
			loadParagraphsForFile,
		});

		expect(results).toHaveLength(1);
		expect(results[0].matches.map((m) => m.text)).toEqual([
			"alpha only",
			"beta only",
		]);
	});

	it("returns cancelled when isCancelled becomes true", async () => {
		const indexData = {
			v: 5,
			f: ["article-1"],
			t: { grace: [-1, 0] },
		};
		const loadParagraphsForFile = jest.fn().mockImplementation(async () => {
			await new Promise((r) => setTimeout(r, 5));
			return ["Grace"];
		});

		const { cancelled, results } = await runResearchSearch({
			indexData,
			searchQuery: "grace",
			libraryTags: [{ _id: "article-1", title: "Grace" }],
			loadParagraphsForFile,
			isCancelled: () => true,
		});

		expect(cancelled).toBe(true);
		expect(results).toEqual([]);
	});

	it("reports progress while loading v5 paragraphs", async () => {
		const onProgress = jest.fn();
		const indexData = {
			v: 5,
			f: ["article-1", "article-2"],
			t: { grace: [-1, 0, -2, 0] },
		};
		const loadParagraphsForFile = jest
			.fn()
			.mockResolvedValueOnce(["grace one"])
			.mockResolvedValueOnce(["grace two"]);

		await runResearchSearch({
			indexData,
			searchQuery: "grace",
			libraryTags: [
				{ _id: "article-1", title: "One" },
				{ _id: "article-2", title: "Two" },
			],
			loadParagraphsForFile,
			onProgress,
		});

		expect(onProgress).toHaveBeenCalled();
		expect(onProgress).toHaveBeenCalledWith(50);
	});

	it("searches v4 indexes with embedded paragraphs", async () => {
		const indexData = {
			v: 4,
			f: ["article-1"],
			d: [["Grace under pressure", "Other"]],
			t: { grace: [-1, 0] },
		};

		const { results } = await runResearchSearch({
			indexData,
			searchQuery: "grace",
			libraryTags: [{ _id: "article-1", title: "Grace" }],
			loadParagraphsForFile: jest.fn(),
		});

		expect(results).toHaveLength(1);
		expect(results[0].matches[0].text).toBe("Grace under pressure");
	});

	it("searches v3 indexes with pairwise refs", async () => {
		const indexData = {
			v: 3,
			f: ["article-1"],
			d: [["Grace under pressure"]],
			t: { grace: [0, 0] },
		};

		const { results } = await runResearchSearch({
			indexData,
			searchQuery: "grace",
			libraryTags: [{ _id: "article-1", title: "Grace" }],
		});

		expect(results).toHaveLength(1);
		expect(results[0].docId).toBe("article-1");
	});

	it("searches v1 indexes via tokens and files", async () => {
		const indexData = {
			v: 1,
			files: {
				docA: {
					paragraphs: ["Grace abounds", "Other"],
					tag: { title: "A", _id: "docA" },
				},
			},
			tokens: { grace: ["docA:0"] },
		};

		const { results } = await runResearchSearch({
			indexData,
			searchQuery: "grace",
		});

		expect(results).toHaveLength(1);
		expect(results[0].docId).toBe("docA");
		expect(results[0].matches[0].text).toBe("Grace abounds");
	});

	it("builds session docs from sessionsById and strips title matches", async () => {
		const sessionId = "session|american|2026|2026-01-01|Grace study";
		const sessionsById = new Map([
			[
				sessionId,
				{
					group: "american",
					year: "2026",
					date: "2026-01-01",
					name: "Grace study",
					type: "video",
				},
			],
		]);
		const indexData = {
			v: 5,
			f: [sessionId],
			t: { grace: [-1, 0, -1, 1] },
		};
		const loadParagraphsForFile = jest
			.fn()
			.mockResolvedValue(["Grace study", "Grace abounds in practice"]);

		const { results } = await runResearchSearch({
			indexData,
			searchQuery: "grace",
			sessionsById,
			loadParagraphsForFile,
		});

		expect(results).toHaveLength(1);
		expect(results[0].isSession).toBe(true);
		expect(results[0].matches[0].text).toBe("Grace abounds in practice");
		expect(results[0].customTags).toEqual(
			expect.arrayContaining([
				{ label: "Group", value: "American" },
				{ label: "Type", value: "Video" },
			]),
		);
	});

	it("builds session docs from tag id parts when sessionsById misses", async () => {
		const sessionId = "session|ai|2024|2024-06-01|Hope";
		const indexData = {
			v: 5,
			f: [sessionId],
			t: { hope: [-1, 1] },
		};
		const loadParagraphsForFile = jest
			.fn()
			.mockResolvedValue(["Hope", "Hope remains"]);

		const { results } = await runResearchSearch({
			indexData,
			searchQuery: "hope",
			loadParagraphsForFile,
		});

		expect(results).toHaveLength(1);
		expect(results[0].isSession).toBe(true);
		expect(results[0].customTags).toEqual(
			expect.arrayContaining([{ label: "Group", value: "AI" }]),
		);
	});

	it("returns null for malformed session ids and unknown articles", async () => {
		const indexData = {
			v: 5,
			f: ["session|bad", "missing-article"],
			t: { x: [-1, 0, -2, 0] },
		};
		const loadParagraphsForFile = jest
			.fn()
			.mockResolvedValueOnce(["x"])
			.mockResolvedValueOnce(["x"]);

		const { results } = await runResearchSearch({
			indexData,
			searchQuery: "x",
			libraryTags: [],
			loadParagraphsForFile,
		});

		expect(results).toEqual([]);
	});

	it("adds filter-only session summary matches from description", async () => {
		const sessionId = "session|group|2024|2024-01-01|Alpha";
		const sessionsById = new Map([
			[
				sessionId,
				{
					group: "group",
					year: "2024",
					date: "2024-01-01",
					name: "Alpha",
					type: "audio",
					description: "A unique summary about practice",
				},
			],
		]);
		const indexData = { v: 5, f: [sessionId], t: {} };
		const loadParagraphsForFile = jest.fn().mockResolvedValue(["Alpha"]);

		const { results } = await runResearchSearch({
			indexData,
			searchQuery: "",
			sessionsById,
			loadParagraphsForFile,
		});

		expect(results).toHaveLength(1);
		expect(results[0].matches[0].text).toContain("unique summary");
	});

	it("picks a non-title paragraph when filter-only session summary matches name", async () => {
		const sessionId = "session|group|2024|2024-01-01|Alpha";
		const sessionsById = new Map([
			[
				sessionId,
				{
					group: "group",
					year: "2024",
					date: "2024-01-01",
					name: "Alpha",
					type: "audio",
					summary: "Alpha",
				},
			],
		]);
		const indexData = { v: 5, f: [sessionId], t: {} };
		const loadParagraphsForFile = jest
			.fn()
			.mockResolvedValue(["Alpha", "Practice notes for the session"]);

		const { results } = await runResearchSearch({
			indexData,
			searchQuery: "",
			sessionsById,
			loadParagraphsForFile,
		});

		expect(results).toHaveLength(1);
		expect(results[0].matches[0].text).toContain("Practice notes");
	});

	it("uses first non-title paragraph when no summary is available", async () => {
		const sessionId = "session|group|2024|2024-01-01|Grace";
		const sessionsById = new Map([
			[
				sessionId,
				{
					group: "group",
					year: "2024",
					date: "2024-01-01",
					name: "Grace",
					type: "audio",
				},
			],
		]);
		const indexData = { v: 5, f: [sessionId], t: {} };
		const loadParagraphsForFile = jest
			.fn()
			.mockResolvedValue(["Something else entirely"]);

		const { results } = await runResearchSearch({
			indexData,
			searchQuery: "",
			sessionsById,
			loadParagraphsForFile,
		});

		expect(results).toHaveLength(1);
		expect(results[0].matches[0].text).toBe("Something else entirely");
	});

	it("skips empty OR groups and missing token refs", async () => {
		const indexData = {
			v: 5,
			f: ["article-1"],
			t: {},
		};
		const loadParagraphsForFile = jest.fn().mockResolvedValue(["text"]);

		const { results } = await runResearchSearch({
			indexData,
			searchQuery: "missingtoken",
			libraryTags: [{ _id: "article-1", title: "One" }],
			loadParagraphsForFile,
		});

		expect(results).toEqual([]);
		expect(loadParagraphsForFile).not.toHaveBeenCalled();
	});

	it("cancels during filter-only paragraph loading", async () => {
		const indexData = {
			v: 5,
			f: ["article-1"],
			t: {},
		};
		let calls = 0;
		const loadParagraphsForFile = jest.fn().mockImplementation(async () => {
			calls += 1;
			return ["text"];
		});

		const { cancelled } = await runResearchSearch({
			indexData,
			searchQuery: "",
			libraryTags: [{ _id: "article-1", title: "One" }],
			loadParagraphsForFile,
			isCancelled: () => calls >= 0,
		});

		expect(cancelled).toBe(true);
	});

	it("partial-token matching finds index keys containing the query term", async () => {
		const indexData = {
			v: 5,
			f: ["article-1"],
			t: { gracefully: [-1, 0] },
		};
		const loadParagraphsForFile = jest
			.fn()
			.mockResolvedValue(["She moved with grace today"]);

		const { results } = await runResearchSearch({
			indexData,
			searchQuery: "grace",
			libraryTags: [{ _id: "article-1", title: "One" }],
			loadParagraphsForFile,
		});

		expect(results).toHaveLength(1);
		expect(results[0].matches[0].text).toBe("She moved with grace today");
	});

	it("drops session title-only matches when no later paragraph exists", async () => {
		const sessionId = "session|g|2024|2024-01-01|Grace";
		const indexData = {
			v: 5,
			f: [sessionId],
			t: { grace: [-1, 0] },
		};
		const loadParagraphsForFile = jest.fn().mockResolvedValue(["Grace"]);

		const { results } = await runResearchSearch({
			indexData,
			searchQuery: "grace",
			sessionsById: new Map([
				[
					sessionId,
					{
						group: "g",
						year: "2024",
						date: "2024-01-01",
						name: "Grace",
						type: "video",
					},
				],
			]),
			loadParagraphsForFile,
		});

		expect(results).toEqual([]);
	});

	it("searches v2 indexes with string token refs", async () => {
		const indexData = {
			v: 2,
			f: ["article-1"],
			d: [["Grace under pressure"]],
			t: { grace: ["0:0"] },
		};
		const { results } = await runResearchSearch({
			indexData,
			searchQuery: "grace",
			libraryTags: [{ _id: "article-1", title: "Grace" }],
		});
		expect(results).toHaveLength(1);
	});

	it("capitalizes ai group names as AI in session docs", async () => {
		const sessionId = "session|ai|2024|2024-01-01|Talk";
		const indexData = {
			v: 5,
			f: [sessionId],
			t: { talk: [-1, 1] },
		};
		const loadParagraphsForFile = jest
			.fn()
			.mockResolvedValue(["Talk", "Talk content"]);
		const { results } = await runResearchSearch({
			indexData,
			searchQuery: "talk",
			loadParagraphsForFile,
		});
		expect(results[0].customTags).toEqual(
			expect.arrayContaining([{ label: "Group", value: "AI" }]),
		);
	});

	it("returns empty highlight for whitespace-only queries with no files", async () => {
		const { results, highlight } = await runResearchSearch({
			indexData: { v: 5, f: [], t: {} },
			searchQuery: "   ",
		});
		expect(results).toEqual([]);
		expect(highlight).toEqual([]);
	});

	it("returns empty token refs when index refs are missing", async () => {
		const indexData = {
			v: 5,
			f: ["article-1"],
			t: { grace: null },
		};
		const { results } = await runResearchSearch({
			indexData,
			searchQuery: "grace",
			libraryTags: [{ _id: "article-1", title: "One" }],
			loadParagraphsForFile: jest.fn().mockResolvedValue(["Grace"]),
		});
		expect(results).toEqual([]);
	});

	it("ignores positive token refs without a preceding file index", async () => {
		const indexData = {
			v: 5,
			f: ["article-1"],
			t: { grace: [0] },
		};
		const { results } = await runResearchSearch({
			indexData,
			searchQuery: "grace",
			libraryTags: [{ _id: "article-1", title: "One" }],
			loadParagraphsForFile: jest.fn().mockResolvedValue(["Grace"]),
		});
		expect(results).toEqual([]);
	});

	it("promotes the second paragraph after stripping a title-only session match", async () => {
		const sessionId = "session|g|2024|2024-01-01|Grace";
		const indexData = {
			v: 5,
			f: [sessionId],
			t: { grace: [-1, 0, -1, 1] },
		};
		const loadParagraphsForFile = jest
			.fn()
			.mockResolvedValue(["Grace", "Grace in practice"]);

		const { results } = await runResearchSearch({
			indexData,
			searchQuery: "grace",
			sessionsById: new Map([
				[
					sessionId,
					{
						group: "g",
						year: "2024",
						date: "2024-01-01",
						name: "Grace",
						type: "video",
					},
				],
			]),
			loadParagraphsForFile,
		});

		expect(results).toHaveLength(1);
		expect(results[0].matches[0].text).toBe("Grace in practice");
	});

	it("cancels during the token intersection loop", async () => {
		const indexData = {
			v: 5,
			f: ["article-1"],
			t: { grace: [-1, 0], under: [-1, 0] },
		};
		let calls = 0;
		const { cancelled } = await runResearchSearch({
			indexData,
			searchQuery: "grace AND under",
			libraryTags: [{ _id: "article-1", title: "One" }],
			loadParagraphsForFile: jest.fn().mockResolvedValue(["Grace under"]),
			isCancelled: () => ++calls > 1,
		});
		expect(cancelled).toBe(true);
	});

	it("reads legacy token maps from indexData.tokens", async () => {
		const indexData = {
			v: 1,
			files: {
				docA: {
					paragraphs: ["Legacy token hit"],
					tag: { title: "A", _id: "docA" },
				},
			},
			tokens: { legacy: ["docA:0"] },
		};
		const { results } = await runResearchSearch({
			indexData,
			searchQuery: "legacy",
		});
		expect(results).toHaveLength(1);
		expect(results[0].matches[0].text).toBe("Legacy token hit");
	});

	it("skips paragraphs that fail clause matching", async () => {
		const indexData = {
			v: 5,
			f: ["article-1"],
			t: { grace: [-1, 0, -1, 1] },
		};
		const loadParagraphsForFile = jest
			.fn()
			.mockResolvedValue(["Unrelated", "Grace abounds"]);

		const { results } = await runResearchSearch({
			indexData,
			searchQuery: "grace AND missing",
			libraryTags: [{ _id: "article-1", title: "One" }],
			loadParagraphsForFile,
		});

		expect(results).toEqual([]);
	});

	it("reports progress while loading missing v5 files after search", async () => {
		const onProgress = jest.fn();
		const indexData = {
			v: 5,
			f: ["article-1", "article-2"],
			t: { grace: [-1, 0] },
		};
		const loadParagraphsForFile = jest
			.fn()
			.mockResolvedValueOnce(["Grace one"])
			.mockResolvedValueOnce(["Grace two"]);

		await runResearchSearch({
			indexData,
			searchQuery: "grace",
			libraryTags: [
				{ _id: "article-1", title: "One" },
				{ _id: "article-2", title: "Two" },
			],
			loadParagraphsForFile,
			onProgress,
		});

		expect(onProgress).toHaveBeenCalledWith(expect.any(Number));
	});

	it("skips refs whose paragraph index is missing", async () => {
		const indexData = {
			v: 5,
			f: ["article-1"],
			t: { grace: [-1, 9] },
		};
		const { results } = await runResearchSearch({
			indexData,
			searchQuery: "grace",
			libraryTags: [{ _id: "article-1", title: "One" }],
			loadParagraphsForFile: jest.fn().mockResolvedValue(["Only paragraph"]),
		});
		expect(results).toEqual([]);
	});

	it("returns null for unknown v1 documents", async () => {
		const indexData = {
			v: 1,
			files: {},
			tokens: { ghost: ["missing:0"] },
		};
		const { results } = await runResearchSearch({
			indexData,
			searchQuery: "ghost",
		});
		expect(results).toEqual([]);
	});

	it("promotes the next paragraph after stripping a title-only session match", async () => {
		const sessionId = "session|group|2024|2024-01-01|Grace";
		const indexData = {
			v: 5,
			f: [sessionId],
			t: { grace: [-1, 0, -1, 1] },
		};
		const loadParagraphsForFile = jest
			.fn()
			.mockResolvedValue(["Grace", "Grace in practice"]);

		const { results } = await runResearchSearch({
			indexData,
			searchQuery: "grace",
			sessionsById: new Map([
				[
					sessionId,
					{
						group: "group",
						year: "2024",
						date: "2024-01-01",
						name: "Grace",
						type: "audio",
					},
				],
			]),
			loadParagraphsForFile,
		});

		expect(results[0].matches[0].text).toBe("Grace in practice");
	});

	it("searches v3 indexes stored in the d array", async () => {
		const indexData = {
			v: 3,
			f: ["article-1"],
			d: [["Legacy v3 paragraph"]],
			t: { legacy: [0, 0] },
		};

		const { results } = await runResearchSearch({
			indexData,
			searchQuery: "legacy",
			libraryTags: [{ _id: "article-1", title: "Legacy" }],
		});

		expect(results[0].matches[0].text).toBe("Legacy v3 paragraph");
	});

	it("searches v4 indexes using compressed negative file refs", async () => {
		const indexData = {
			v: 4,
			f: ["article-1"],
			d: [["Legacy v4 paragraph"]],
			t: { legacy: [-1, 0] },
		};

		const { results } = await runResearchSearch({
			indexData,
			searchQuery: "legacy",
			libraryTags: [{ _id: "article-1", title: "Legacy" }],
		});

		expect(results[0].matches[0].text).toBe("Legacy v4 paragraph");
	});

	it("honours cancellation while loading v5 paragraph files", async () => {
		const indexData = {
			v: 5,
			f: ["article-1"],
			t: { grace: [-1, 0] },
		};
		const { cancelled } = await runResearchSearch({
			indexData,
			searchQuery: "grace",
			libraryTags: [{ _id: "article-1", title: "One" }],
			loadParagraphsForFile: jest.fn().mockResolvedValue(["Grace"]),
			isCancelled: () => true,
		});

		expect(cancelled).toBe(true);
	});
});
