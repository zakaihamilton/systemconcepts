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

	it("joins array children into a string", () => {
		expect(normalizeMarkdownContent(["Hello", " ", "World"])).toBe(
			"Hello World",
		);
	});

	it("promotes standalone title lines to headings", () => {
		const result = normalizeMarkdownContent("Short Title\nNext line");
		expect(result).toContain("### Short Title");
	});

	it("leaves lines ending in punctuation unchanged", () => {
		const input = "This is a sentence.\nNext line";
		expect(normalizeMarkdownContent(input)).not.toContain(
			"### This is a sentence.",
		);
	});

	it("skips empty lines when promoting headings", () => {
		const input = "   \nActual Title\nNext";
		expect(normalizeMarkdownContent(input)).toContain("### Actual Title");
	});

	it("skips long lines when promoting headings", () => {
		const long = "A".repeat(121);
		expect(normalizeMarkdownContent(`${long}\nnext`)).not.toContain("###");
	});

	it("normalizes nbsp, zero-width spaces, and spaced commas", () => {
		expect(normalizeMarkdownContent("a\u00A0b")).toBe("a b");
		expect(normalizeMarkdownContent("a\u200Bb")).toBe("ab");
		expect(normalizeMarkdownContent("before , after")).toBe("before, after");
	});
});
