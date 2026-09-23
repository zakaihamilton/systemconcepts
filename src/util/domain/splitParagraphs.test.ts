import {
	mergeChunks,
	splitIntoParagraphs,
	splitSmart,
} from "./splitParagraphs";

describe("splitParagraphs", () => {
	it("returns empty for empty input", () => {
		expect(splitSmart("")).toEqual([]);
		expect(mergeChunks([])).toEqual([]);
		expect(splitIntoParagraphs("")).toEqual([]);
	});

	it("splits on double newlines", () => {
		expect(splitSmart("one\n\ntwo\n\nthree")).toEqual(["one", "two", "three"]);
	});

	it("keeps fenced code blocks intact", () => {
		const text = "intro\n\n```js\nconst x = 1;\n\nconst y = 2;\n```\n\noutro";
		expect(splitSmart(text)).toEqual([
			"intro",
			"```js\nconst x = 1;\n\nconst y = 2;\n```",
			"outro",
		]);
	});

	it("merges consecutive list and quote chunks", () => {
		expect(mergeChunks(["- a", "- b", "plain", "> q1", "> q2"])).toEqual([
			"- a\n\n- b",
			"plain",
			"> q1\n\n> q2",
		]);
	});

	it("splitIntoParagraphs chains split and merge", () => {
		expect(splitIntoParagraphs("- a\n\n- b\n\ntext")).toEqual([
			"- a\n\n- b",
			"text",
		]);
	});
});
