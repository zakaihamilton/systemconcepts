export function normalizeMarkdownContent(children) {
	let content = children;
	if (Array.isArray(content)) content = content.join("");
	if (typeof content !== "string") return content;

	content = content.replace(/\r\n/g, "\n");
	content = content.replace(/\n+/g, "\n\n");
	content = content.replace(
		/^\s*(\d+)([\.\)])[ \t]*/gm,
		(_match, number, symbol) => `\n\n**${number}\\${symbol}** `,
	);
	content = content.replace(
		/^[ \t]*(?!#|-|\*|\d)([A-Z].*?)[ \t]*(\r?\n)/gm,
		(match, line, newline, offset) => {
			const trimmed = line.trim();
			if (!trimmed || /[.;,]$/.test(trimmed) || trimmed.length > 120) {
				return match;
			}
			const afterMatch = content.slice(offset + match.length);
			const nextLineMatch = afterMatch.match(/^[ \t]*(\S)/);
			if (nextLineMatch && /[a-z]/.test(nextLineMatch[1])) return match;
			return `### ${trimmed}${newline}`;
		},
	);
	content = content.replace(/\u00A0/g, " ");
	content = content.replace(/\u200B/g, "");
	content = content.replace(/,[\s,]+,/g, ",");
	return content.replace(/ ,/g, ",");
}
