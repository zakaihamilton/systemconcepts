import { normalizeMarkdownContent } from "./content";

describe("markdown content normalization", () => {
	it("normalizes line endings, numbered lists, and repeated commas", () => {
		expect(normalizeMarkdownContent("1) First\r\n\r\nValue, , next")).toContain(
			"**1\\)** First",
		);
		expect(normalizeMarkdownContent("Value, , next")).toBe("Value, next");
	});

	it("leaves non-string content untouched", () => {
		const child = { type: "node" };
		expect(normalizeMarkdownContent(child)).toBe(child);
	});
});
