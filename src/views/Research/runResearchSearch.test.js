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

	it("intersects AND tokens and verifies v5 paragraphs", async () => {
		const indexData = {
			v: 5,
			f: ["article-1"],
			// compressed: file 0 header (-1), para 0 for grace; same for under
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
});
