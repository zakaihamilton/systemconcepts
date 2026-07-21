import {
	abbreviateNumber,
	abbreviateSize,
	copyToClipboard,
	formatDuration,
	isRTL,
	makeCommaSeparatedString,
	normalizeContent,
	preprocessMarkdown,
} from "./string";

describe("makeCommaSeparatedString", () => {
	it("returns an empty string for an empty array", () => {
		expect(makeCommaSeparatedString([])).toBe("");
	});

	it("returns the single item unchanged", () => {
		expect(makeCommaSeparatedString(["a"])).toBe("a");
	});

	it("joins two items with 'and' regardless of oxford comma", () => {
		expect(makeCommaSeparatedString(["a", "b"], false)).toBe("a and b");
		expect(makeCommaSeparatedString(["a", "b"], true)).toBe("a and b");
	});

	it("omits the oxford comma when not requested", () => {
		expect(makeCommaSeparatedString(["a", "b", "c"], false)).toBe("a, b and c");
	});

	it("includes the oxford comma when requested with 3+ items", () => {
		expect(makeCommaSeparatedString(["a", "b", "c"], true)).toBe("a, b, and c");
	});
});

describe("abbreviateNumber", () => {
	it("returns the raw number when below 1000", () => {
		expect(abbreviateNumber(500)).toBe(500);
	});

	it("abbreviates thousands with a k suffix", () => {
		expect(abbreviateNumber(1500)).toBe("1.5k");
	});

	it("abbreviates millions with an M suffix", () => {
		expect(abbreviateNumber(2500000)).toBe("2.5M");
	});

	it("abbreviates billions with a G suffix", () => {
		expect(abbreviateNumber(5_000_000_000)).toBe("5.0G");
	});

	it("returns 0 unchanged", () => {
		expect(abbreviateNumber(0)).toBe(0);
	});
});

describe("abbreviateSize", () => {
	it("appends a 'b' suffix for small sizes", () => {
		expect(abbreviateSize(500)).toBe("500b");
	});

	it("abbreviates kilobytes with a KB suffix", () => {
		expect(abbreviateSize(1500)).toBe("1.5KB");
	});

	it("abbreviates megabytes with an MB suffix", () => {
		expect(abbreviateSize(2_500_000)).toBe("2.5MB");
	});

	it("handles zero", () => {
		expect(abbreviateSize(0)).toBe("0b");
	});
});

describe("isRTL", () => {
	it("returns true for Hebrew text", () => {
		expect(isRTL("שלום")).toBe(true);
	});

	it("returns false for Latin text", () => {
		expect(isRTL("hello")).toBe(false);
	});
});

describe("formatDuration", () => {
	it("returns 00:00 for undefined", () => {
		expect(formatDuration(undefined)).toBe("00:00");
	});

	it("returns 00:00 for null", () => {
		expect(formatDuration(null)).toBe("00:00");
	});

	it("returns 00:00 for NaN", () => {
		expect(formatDuration(NaN)).toBe("00:00");
	});

	it("returns 00:00 for a negative duration", () => {
		expect(formatDuration(-5)).toBe("00:00");
	});

	it("formats seconds only", () => {
		expect(formatDuration(5000)).toBe("00:05");
	});

	it("formats minutes and seconds", () => {
		expect(formatDuration(65000)).toBe("01:05");
	});

	it("formats hours, minutes and seconds when hours are present", () => {
		expect(formatDuration(3665000)).toBe("01:01:05");
	});

	it("includes hours when includeHours is true even if hours are zero", () => {
		expect(formatDuration(5000, true)).toBe("00:00:05");
	});
});

describe("copyToClipboard", () => {
	const originalClipboard = navigator.clipboard;

	afterEach(() => {
		Object.defineProperty(navigator, "clipboard", {
			value: originalClipboard,
			configurable: true,
		});
	});

	it("writes text to the clipboard and returns true when available", () => {
		const writeText = jest.fn();
		Object.defineProperty(navigator, "clipboard", {
			value: { writeText },
			configurable: true,
		});

		expect(copyToClipboard("hello")).toBe(true);
		expect(writeText).toHaveBeenCalledWith("hello");
	});

	it("returns false when the clipboard API is unavailable", () => {
		Object.defineProperty(navigator, "clipboard", {
			value: undefined,
			configurable: true,
		});

		expect(copyToClipboard("hello")).toBe(false);
	});
});

describe("normalizeContent", () => {
	it("returns an empty string for non-string input", () => {
		expect(normalizeContent(42)).toBe("");
	});

	it("leaves code blocks untouched", () => {
		const text = "```js\nfoo\n```";
		expect(normalizeContent(text)).toBe(text);
	});

	it("doubles single newlines", () => {
		expect(normalizeContent("line1\nline2")).toBe("line1\n\nline2");
	});

	it("normalizes CRLF line endings", () => {
		expect(normalizeContent("line1\r\nline2")).toBe("line1\n\nline2");
	});

	it("wraps a header-like line in an h3", () => {
		expect(normalizeContent("Introduction\nSome text")).toBe(
			"### Introduction\n\n\nSome text",
		);
	});

	it("does not treat sentences ending in punctuation as headers", () => {
		expect(normalizeContent("This is a sentence.\nMore text")).toBe(
			"This is a sentence.\n\nMore text",
		);
	});
});

describe("preprocessMarkdown", () => {
	it("returns falsy content unchanged", () => {
		expect(preprocessMarkdown(null)).toBeNull();
		expect(preprocessMarkdown("")).toBe("");
	});

	it("adds line breaks around bold headers", () => {
		expect(preprocessMarkdown("Text **Key Points:** more")).toBe(
			"Text\n\n**Key Points:**\n\nmore",
		);
	});

	it("adds line breaks before plain list items", () => {
		expect(preprocessMarkdown("intro - item one - item two")).toBe(
			"intro\n- item one\n- item two",
		);
	});

	it("adds line breaks before bold list items", () => {
		expect(preprocessMarkdown("intro - **bold item**")).toBe(
			"intro\n\n- **bold item**",
		);
	});

	it("adds line breaks before triple-hash headers", () => {
		expect(preprocessMarkdown("intro ### Header")).toBe("intro\n\n### Header");
	});

	it("adds line breaks before numbered list items", () => {
		expect(preprocessMarkdown("intro 1. first 2. second")).toBe(
			"intro\n1. first\n2. second",
		);
	});

	it("collapses three or more consecutive newlines", () => {
		expect(preprocessMarkdown("a\n\n\n\nb")).toBe("a\n\nb");
	});
});
