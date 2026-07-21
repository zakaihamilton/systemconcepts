import {
	getZipTextEntryId,
	normalizeTags,
	parseSessionMetadataJSON,
	parseSummariesMarkdown,
} from "./metadataParser";

describe("getZipTextEntryId", () => {
	it("returns the id for a top-level txt file", () => {
		expect(getZipTextEntryId("2024-05-05 Test Session.txt")).toBe(
			"2024-05-05 Test Session",
		);
	});

	it("returns the id for a nested txt file", () => {
		expect(
			getZipTextEntryId("Transcriptions/2024-05-05 Test Session.TXT"),
		).toBe("2024-05-05 Test Session");
	});

	it("returns null for macOS metadata files", () => {
		expect(
			getZipTextEntryId("__MACOSX/Transcriptions/._2024-05-05 Test.TXT"),
		).toBeNull();
	});

	it("returns null for non-txt files", () => {
		expect(getZipTextEntryId("2024-05-05 Test Session.vtt")).toBeNull();
	});

	it("returns null when there is no filename", () => {
		expect(getZipTextEntryId("Transcriptions/")).toBeNull();
	});
});

describe("normalizeTags", () => {
	it("returns an empty array for non-array input", () => {
		expect(normalizeTags(null)).toEqual([]);
		expect(normalizeTags(undefined)).toEqual([]);
		expect(normalizeTags("tag")).toEqual([]);
	});

	it("trims strings and removes trailing dots", () => {
		expect(normalizeTags([" ai. ", "sync.."])).toEqual(["ai", "sync"]);
	});

	it("filters out empty/falsy tags after trimming", () => {
		expect(normalizeTags(["  ", "", "valid"])).toEqual(["valid"]);
	});

	it("keeps non-string tag values as-is", () => {
		expect(normalizeTags([1, null, "tag"])).toEqual([1, "tag"]);
	});
});

describe("parseSessionMetadataJSON", () => {
	it("returns an empty object for empty content", () => {
		expect(parseSessionMetadataJSON("", "tags")).toEqual({});
		expect(parseSessionMetadataJSON(null, "tags")).toEqual({});
	});

	it("returns an empty object when sessions is not an array", () => {
		expect(parseSessionMetadataJSON(JSON.stringify({}), "tags")).toEqual({});
		expect(
			parseSessionMetadataJSON(JSON.stringify({ sessions: "nope" }), "tags"),
		).toEqual({});
	});

	it("parses JSON string content and normalizes tags", () => {
		const content = JSON.stringify({
			sessions: [{ sessionName: "2024-05-05 Test", tags: ["ai.", " sync "] }],
		});
		expect(parseSessionMetadataJSON(content, "tags")).toEqual({
			"2024-05-05 Test": ["ai", "sync"],
		});
	});

	it("accepts already-parsed object content", () => {
		const data = {
			sessions: [{ name: "2024-05-05 Test", duration: 123 }],
		};
		expect(parseSessionMetadataJSON(data, "duration")).toEqual({
			"2024-05-05 Test": 123,
		});
	});

	it("falls back to id when sessionName and name are missing", () => {
		const data = { sessions: [{ id: "2024-05-05 Test", duration: 55 }] };
		expect(parseSessionMetadataJSON(data, "duration")).toEqual({
			"2024-05-05 Test": 55,
		});
	});

	it("skips sessions missing a name or the requested property", () => {
		const data = {
			sessions: [
				{ duration: 55 },
				{ name: "2024-05-05 Test" },
				{ name: "2024-05-06 Other", duration: 0 },
			],
		};
		expect(parseSessionMetadataJSON(data, "duration")).toEqual({});
	});
});

describe("parseSummariesMarkdown", () => {
	it("returns an empty object for empty content", () => {
		expect(parseSummariesMarkdown("")).toEqual({});
		expect(parseSummariesMarkdown(null)).toEqual({});
	});

	it("parses a single session summary", () => {
		const content = "## 2024-05-05 Test Session\nSummary line 1\n---\n";
		expect(parseSummariesMarkdown(content)).toEqual({
			"2024-05-05 Test Session": "Summary line 1",
		});
	});

	it("parses multiple session summaries", () => {
		const content = [
			"## 2024-05-05 Test Session",
			"First summary",
			"---",
			"## 2024-05-06 Other Session",
			"Second summary",
			"line two",
			"---",
		].join("\n");
		expect(parseSummariesMarkdown(content)).toEqual({
			"2024-05-05 Test Session": "First summary",
			"2024-05-06 Other Session": "Second summary\nline two",
		});
	});

	it("ignores headers that do not start with a date", () => {
		const content = ["## Not A Date Header", "Body text", "---"].join("\n");
		expect(parseSummariesMarkdown(content)).toEqual({});
	});

	it("ignores content before the first valid header", () => {
		const content = [
			"Some preamble text",
			"## 2024-05-05 Test Session",
			"Summary",
			"---",
		].join("\n");
		expect(parseSummariesMarkdown(content)).toEqual({
			"2024-05-05 Test Session": "Summary",
		});
	});

	it("does not save a buffer with no content", () => {
		const content = ["## 2024-05-05 Empty Session", "---"].join("\n");
		expect(parseSummariesMarkdown(content)).toEqual({});
	});

	it("trims surrounding whitespace from summaries", () => {
		const content = [
			"## 2024-05-05 Test Session",
			"",
			"Summary text",
			"",
			"---",
		].join("\n");
		expect(parseSummariesMarkdown(content)).toEqual({
			"2024-05-05 Test Session": "Summary text",
		});
	});
});
