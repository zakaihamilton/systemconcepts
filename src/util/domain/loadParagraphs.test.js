import { clearParagraphCaches, loadParagraphsForFile } from "./loadParagraphs";

jest.mock("@util/storage/storage", () => ({
	exists: jest.fn(),
	readFile: jest.fn(),
}));

jest.mock("@util/api/logger", () => ({
	logger: {
		warn: jest.fn(),
		error: jest.fn(),
		debug: jest.fn(),
	},
}));

describe("loadParagraphsForFile sessions", () => {
	const storage = require("@util/storage/storage");
	const fileId = "session|american|2026|2026-01-01|Grace study";
	const listSession = {
		name: "Grace study",
		group: "american",
		year: "2026",
		date: "2026-01-01",
		summary: null,
		transcription: true,
	};

	beforeEach(() => {
		jest.clearAllMocks();
		clearParagraphCaches();
	});

	it("reloads summaryText from sync when the catalogue item was stripped", async () => {
		storage.exists.mockImplementation((path) =>
			Promise.resolve(path.endsWith("american.json")),
		);
		storage.readFile.mockResolvedValue(
			JSON.stringify({
				sessions: [
					{
						name: "Grace study",
						group: "american",
						year: "2026",
						date: "2026-01-01",
						description: "Weekly gathering",
						summaryText: "Grace abounds in practice.\n\nHope follows.",
					},
				],
			}),
		);

		const paragraphs = await loadParagraphsForFile(
			fileId,
			new Map([[fileId, listSession]]),
		);

		expect(paragraphs.join("\n")).toContain("Grace abounds in practice");
		expect(paragraphs.join("\n")).toContain("Hope follows");
		expect(storage.readFile).toHaveBeenCalled();
	});

	it("uses year files when the merged group file is absent", async () => {
		storage.exists.mockImplementation((path) =>
			Promise.resolve(path.endsWith("american/2026.json")),
		);
		storage.readFile.mockResolvedValue(
			JSON.stringify({
				sessions: [
					{
						name: "Grace study",
						group: "american",
						year: "2026",
						date: "2026-01-01",
						summaryText: "Loaded from year file",
					},
				],
			}),
		);

		const paragraphs = await loadParagraphsForFile(
			fileId,
			new Map([[fileId, listSession]]),
		);

		expect(paragraphs.some((p) => p.includes("Loaded from year file"))).toBe(
			true,
		);
	});

	it("falls back to summary.path when sync records have no summaryText", async () => {
		const withPath = {
			...listSession,
			summary: { path: "summaries/grace.md" },
		};
		storage.exists.mockImplementation((path) =>
			Promise.resolve(
				path.endsWith("american.json") || path.endsWith("summaries/grace.md"),
			),
		);
		storage.readFile.mockImplementation((path) => {
			if (path.endsWith("american.json")) {
				return Promise.resolve(
					JSON.stringify({
						sessions: [
							{
								name: "Grace study",
								group: "american",
								year: "2026",
								date: "2026-01-01",
								summary: { path: "summaries/grace.md" },
							},
						],
					}),
				);
			}
			return Promise.resolve("Summary from markdown file");
		});

		const paragraphs = await loadParagraphsForFile(
			fileId,
			new Map([[fileId, withPath]]),
		);

		expect(
			paragraphs.some((p) => p.includes("Summary from markdown file")),
		).toBe(true);
	});

	it("reuses cached session records on subsequent loads", async () => {
		storage.exists.mockImplementation((path) =>
			Promise.resolve(path.endsWith("american.json")),
		);
		storage.readFile.mockResolvedValue(
			JSON.stringify({
				sessions: [
					{
						name: "Grace study",
						group: "american",
						year: "2026",
						date: "2026-01-01",
						summaryText: "Cached session body",
					},
				],
			}),
		);

		await loadParagraphsForFile(fileId, new Map([[fileId, listSession]]));
		storage.readFile.mockClear();
		const second = await loadParagraphsForFile(
			fileId,
			new Map([[fileId, listSession]]),
		);

		expect(second.some((p) => p.includes("Cached session body"))).toBe(true);
		expect(storage.readFile).not.toHaveBeenCalled();
	});

	it("warns when session cannot be resolved", async () => {
		const { logger } = require("@util/api/logger");
		storage.exists.mockResolvedValue(false);

		await expect(loadParagraphsForFile(fileId, new Map())).resolves.toEqual([]);
		expect(logger.warn).toHaveBeenCalledWith(
			expect.stringContaining("Session not found"),
		);
	});

	it("returns cached paragraphs on a subsequent call", async () => {
		storage.exists.mockImplementation((path) =>
			Promise.resolve(path.endsWith("american.json")),
		);
		storage.readFile.mockResolvedValue(
			JSON.stringify({
				sessions: [
					{
						name: "Grace study",
						group: "american",
						year: "2026",
						date: "2026-01-01",
						summaryText: "Cached body",
					},
				],
			}),
		);

		const first = await loadParagraphsForFile(
			fileId,
			new Map([[fileId, listSession]]),
		);
		storage.readFile.mockClear();
		const second = await loadParagraphsForFile(
			fileId,
			new Map([[fileId, listSession]]),
		);

		expect(second).toEqual(first);
		expect(storage.readFile).not.toHaveBeenCalled();
	});

	it("uses listSession text when summaryText is already present", async () => {
		const withSummary = {
			...listSession,
			summaryText: "Inline summary paragraph",
			description: "desc",
		};

		const paragraphs = await loadParagraphsForFile(
			fileId,
			new Map([[fileId, withSummary]]),
		);

		expect(paragraphs.some((p) => p.includes("Inline summary paragraph"))).toBe(
			true,
		);
		expect(storage.exists).not.toHaveBeenCalled();
	});
});

describe("loadParagraphsForFile articles", () => {
	const storage = require("@util/storage/storage");

	beforeEach(() => {
		jest.clearAllMocks();
		clearParagraphCaches();
	});

	it("loads article paragraphs from an object payload", async () => {
		storage.exists.mockResolvedValue(true);
		storage.readFile.mockImplementation((path) => {
			if (String(path).endsWith("tags.json")) {
				return Promise.resolve(
					JSON.stringify([{ _id: "article-1", path: "posts/one.json" }]),
				);
			}
			return Promise.resolve(
				JSON.stringify({
					_id: "article-1",
					text: "First para.\n\nSecond para.",
				}),
			);
		});

		const paragraphs = await loadParagraphsForFile("article-1", new Map());
		expect(paragraphs.length).toBeGreaterThan(0);
		expect(paragraphs.join("\n")).toContain("First para");
	});

	it("returns empty when the article tag is missing", async () => {
		storage.exists.mockResolvedValue(true);
		storage.readFile.mockResolvedValue(JSON.stringify([]));

		await expect(
			loadParagraphsForFile("missing-article", new Map()),
		).resolves.toEqual([]);
	});

	it("returns empty when the article file is missing", async () => {
		storage.exists.mockImplementation((path) =>
			Promise.resolve(String(path).endsWith("tags.json")),
		);
		storage.readFile.mockResolvedValue(
			JSON.stringify([{ _id: "article-1", path: "posts/one.json" }]),
		);

		await expect(
			loadParagraphsForFile("article-1", new Map()),
		).resolves.toEqual([]);
	});

	it("reads articles from an array payload", async () => {
		clearParagraphCaches();
		storage.exists.mockResolvedValue(true);
		storage.readFile.mockImplementation((path) => {
			if (String(path).endsWith("tags.json")) {
				return Promise.resolve(
					JSON.stringify([{ _id: "article-2", path: "posts/two.json" }]),
				);
			}
			return Promise.resolve(
				JSON.stringify([
					{ _id: "other", text: "nope" },
					{ _id: "article-2", text: "Array article text" },
				]),
			);
		});

		const paragraphs = await loadParagraphsForFile("article-2", new Map());
		expect(paragraphs.join("\n")).toContain("Array article text");
	});

	it("returns empty when the matched article has no text", async () => {
		storage.exists.mockResolvedValue(true);
		storage.readFile.mockImplementation((path) => {
			if (String(path).endsWith("tags.json")) {
				return Promise.resolve(
					JSON.stringify([{ _id: "article-3", path: "posts/three.json" }]),
				);
			}
			return Promise.resolve(JSON.stringify({ _id: "article-3" }));
		});

		await expect(
			loadParagraphsForFile("article-3", new Map()),
		).resolves.toEqual([]);
	});

	it("returns empty and logs when article JSON parse fails", async () => {
		const { logger } = require("@util/api/logger");
		storage.exists.mockResolvedValue(true);
		storage.readFile.mockImplementation((path) => {
			if (String(path).endsWith("tags.json")) {
				return Promise.resolve(
					JSON.stringify([{ _id: "article-4", path: "posts/four.json" }]),
				);
			}
			return Promise.resolve("{bad");
		});

		await expect(
			loadParagraphsForFile("article-4", new Map()),
		).resolves.toEqual([]);
		expect(logger.error).toHaveBeenCalled();
	});

	it("returns empty when library tags fail to load", async () => {
		const { logger } = require("@util/api/logger");
		storage.exists.mockResolvedValue(true);
		storage.readFile.mockImplementation((path) => {
			if (String(path).endsWith("tags.json")) {
				return Promise.reject(new Error("tags boom"));
			}
			return Promise.resolve("{}");
		});

		await expect(
			loadParagraphsForFile("article-5", new Map()),
		).resolves.toEqual([]);
		expect(logger.error).toHaveBeenCalledWith(
			"Failed to load library tags:",
			expect.any(Error),
		);
	});

	it("reuses cached library tags within the TTL", async () => {
		storage.exists.mockResolvedValue(true);
		storage.readFile.mockImplementation((path) => {
			if (String(path).endsWith("tags.json")) {
				return Promise.resolve(
					JSON.stringify([{ _id: "article-6", path: "posts/six.json" }]),
				);
			}
			return Promise.resolve(
				JSON.stringify({ _id: "article-6", text: "Cached tags article" }),
			);
		});

		await loadParagraphsForFile("article-6", new Map());
		storage.readFile.mockClear();
		storage.readFile.mockImplementation((path) => {
			if (String(path).endsWith("tags.json")) {
				throw new Error("should use cache");
			}
			return Promise.resolve(
				JSON.stringify({ _id: "article-6", text: "Cached tags article" }),
			);
		});

		const paragraphs = await loadParagraphsForFile("article-6", new Map());
		expect(paragraphs.join("\n")).toContain("Cached tags article");
	});

	it("warns and continues when a session sync file cannot be read", async () => {
		const { logger } = require("@util/api/logger");
		const fileId = "session|american|2026|2026-01-01|Grace study";
		storage.exists.mockImplementation((path) =>
			Promise.resolve(path.endsWith("american.json")),
		);
		storage.readFile.mockRejectedValue(new Error("read fail"));

		const paragraphs = await loadParagraphsForFile(
			fileId,
			new Map([[fileId, { name: "Grace study" }]]),
		);
		expect(logger.warn).toHaveBeenCalled();
		expect(paragraphs.join("\n")).toContain("Grace study");
	});

	it("reuses cached library tags across article loads", async () => {
		storage.exists.mockResolvedValue(true);
		storage.readFile.mockImplementation((path) => {
			if (String(path).endsWith("tags.json")) {
				return Promise.resolve(
					JSON.stringify([
						{ _id: "article-1", path: "posts/one.json" },
						{ _id: "article-2", path: "posts/two.json" },
					]),
				);
			}
			if (String(path).endsWith("posts/one.json")) {
				return Promise.resolve(
					JSON.stringify({ _id: "article-1", text: "First article" }),
				);
			}
			return Promise.resolve(
				JSON.stringify({ _id: "article-2", text: "Second article" }),
			);
		});

		await loadParagraphsForFile("article-1", new Map());
		const tagsReads = storage.readFile.mock.calls.filter((call) =>
			String(call[0]).endsWith("tags.json"),
		).length;
		await loadParagraphsForFile("article-2", new Map());
		const tagsReadsAfter = storage.readFile.mock.calls.filter((call) =>
			String(call[0]).endsWith("tags.json"),
		).length;

		expect(tagsReadsAfter).toBe(tagsReads);
	});

	it("returns empty when tags.json is missing", async () => {
		storage.exists.mockResolvedValue(false);
		await expect(
			loadParagraphsForFile("article-7", new Map()),
		).resolves.toEqual([]);
	});

	it("sanitizes summary paths with parent-directory segments", async () => {
		const fileId = "session|american|2026|2026-01-01|Grace study";
		storage.exists.mockImplementation((path) =>
			Promise.resolve(
				path.endsWith("american.json") || path.endsWith("summaries/safe.md"),
			),
		);
		storage.readFile.mockImplementation((path) => {
			if (path.endsWith("american.json")) {
				return Promise.resolve(
					JSON.stringify({
						sessions: [
							{
								name: "Grace study",
								group: "american",
								year: "2026",
								date: "2026-01-01",
								summary: { path: "../summaries/safe.md" },
							},
						],
					}),
				);
			}
			return Promise.resolve("Sanitized summary body");
		});

		const paragraphs = await loadParagraphsForFile(
			fileId,
			new Map([[fileId, { name: "Grace study" }]]),
		);
		expect(paragraphs.join("\n")).toContain("Sanitized summary body");
	});

	it("returns empty paragraphs for invalid session ids", async () => {
		const paragraphs = await loadParagraphsForFile("not-a-session", new Map());
		expect(paragraphs).toEqual([]);
	});

	it("loads article paragraphs from array-shaped library files", async () => {
		storage.exists.mockResolvedValue(true);
		storage.readFile.mockImplementation((path) => {
			if (String(path).endsWith("tags.json")) {
				return Promise.resolve(
					JSON.stringify([{ _id: "article-3", path: "posts/array.json" }]),
				);
			}
			return Promise.resolve(
				JSON.stringify([
					{ _id: "other", text: "skip" },
					{ _id: "article-3", text: "Array article body" },
				]),
			);
		});

		const paragraphs = await loadParagraphsForFile("article-3", new Map());
		expect(paragraphs.join("\n")).toContain("Array article body");
	});

	it("returns empty when article tag exists but file content has no text", async () => {
		storage.exists.mockResolvedValue(true);
		storage.readFile.mockImplementation((path) => {
			if (String(path).endsWith("tags.json")) {
				return Promise.resolve(
					JSON.stringify([{ _id: "article-4", path: "posts/empty.json" }]),
				);
			}
			return Promise.resolve(JSON.stringify({ _id: "article-4" }));
		});

		await expect(
			loadParagraphsForFile("article-4", new Map()),
		).resolves.toEqual([]);
	});

	it("uses the paragraph cache for repeated session loads", async () => {
		const fileId = "session|american|2026|2026-01-01|Grace study";
		storage.exists.mockResolvedValue(false);
		const paragraphs = await loadParagraphsForFile(
			fileId,
			new Map([
				[
					fileId,
					{
						name: "Grace study",
						description: "Cached session",
						summaryText: "Body",
					},
				],
			]),
		);
		expect(paragraphs.join("\n")).toContain("Cached session");
		const second = await loadParagraphsForFile(
			fileId,
			new Map([
				[
					fileId,
					{
						name: "Grace study",
						description: "Cached session",
						summaryText: "Body",
					},
				],
			]),
		);
		expect(second).toBe(paragraphs);
	});

	it("returns empty when tag lookup fails to parse library tags", async () => {
		storage.exists.mockResolvedValue(true);
		storage.readFile.mockRejectedValue(new Error("read failed"));
		await expect(
			loadParagraphsForFile("article-bad", new Map()),
		).resolves.toEqual([]);
	});
});
