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

		expect(paragraphs.some((p) => p.includes("Summary from markdown file"))).toBe(
			true,
		);
	});
});
