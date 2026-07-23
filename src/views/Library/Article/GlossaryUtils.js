import { abbreviations } from "@data/abbreviations";
import { glossary } from "@data/glossary";

// Create the regex once since glossary is constant
// Sort keys by length descending to ensure multi-word terms (e.g. "hitpashtut aleph") are matched before single words
const sortedKeys = Object.keys(glossary).sort((a, b) => b.length - a.length);
// Escape special characters in keys to prevent regex errors
const escapedKeys = sortedKeys.map((key) =>
	key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
);
export const termPattern = new RegExp(`\\b(${escapedKeys.join("|")})\\b`, "gi");

// Create abbreviation regex
const abbreviationKeys = Object.keys(abbreviations).sort(
	(a, b) => b.length - a.length,
);
const abbreviationPatterns = abbreviationKeys.map((key) => {
	const expansion = abbreviations[key];
	const escapedExpansion = expansion.eng.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	return `\\b${key}\\b(?:\\s*\\(${escapedExpansion}\\))?`;
});
export const abbreviationPattern = new RegExp(
	`(${abbreviationPatterns.join("|")})`,
	"gi",
);

/**
 * Glossary keys that collide with ordinary English words (or common particles
 * that appear as whole words in English prose). Matching these rewrites
 * English meaning — e.g. "over" → "Crosses" (עובר).
 */
export const AMBIGUOUS_ENGLISH_GLOSSARY_KEYS = new Set([
	"over",
	"or",
	"av", // also the Hebrew month (e.g. "9th of Av"), not "Coarse"
	"al",
	"ha",
	"ve",
	"lo",
	"et",
	"de",
	"ba",
	"mat",
	"kar",
	"ra",
	"ot",
	"dam",
	"bet",
	"bat",
	"sod",
	"death",
	"hey",
	"adam",
	"ima",
	"din",
	"lev",
	"ayin",
	"peh",
	"ani",
	"meod",
	"yam",
	"ir",
	"har",
	"ish",
	"tam",
	"bor",
	"sof",
]);

/**
 * Ambiguous keys that may be intentional Hebrew transliterations when
 * Capitalized mid-sentence (e.g. "the Or of Atzilut"). Lowercase and
 * sentence-initial Capitalized forms are still treated as English.
 */
export const CAPITALIZED_MID_SENTENCE_GLOSSARY_KEYS = new Set([
	"or",
	"adam",
	"ima",
	"din",
	"lev",
	"ayin",
	"peh",
	"ani",
]);

export function hasConfirmingGlossaryParenthetical(
	text,
	end,
	term,
	glossaryEntry,
) {
	if (!text || typeof text !== "string") return false;
	const parentheticalMatch = /^\s*\(([^)]+)\)/.exec(text.slice(end));
	if (!parentheticalMatch) return false;
	const content = parentheticalMatch[1].trim().toLowerCase();
	const mainText = (
		glossaryEntry?.en ||
		glossaryEntry?.trans ||
		term
	).toLowerCase();
	return content === mainText || content === term.toLowerCase();
}

function isStartOfSentence(text, start) {
	return start === 0 || /[.!?]\s+$/.test(text.slice(0, start));
}

/**
 * Skip glossary matches that are ordinary English prose, not Hebrew
 * transliterations. Confirmed glosses like `Over (Crosses)` are kept.
 */
export function shouldSkipGlossaryTerm(term, text, start) {
	if (!term || typeof term !== "string") return false;

	const lower = term.toLowerCase();
	if (!AMBIGUOUS_ENGLISH_GLOSSARY_KEYS.has(lower)) {
		return false;
	}

	const end = start + term.length;
	const entry = glossary[lower];
	if (hasConfirmingGlossaryParenthetical(text, end, term, entry)) {
		return false;
	}

	if (CAPITALIZED_MID_SENTENCE_GLOSSARY_KEYS.has(lower)) {
		if (term === lower) {
			return true;
		}
		return isStartOfSentence(text, start);
	}

	// Other ambiguous keys: never treat bare English forms as glossary terms
	return true;
}

export function replaceAbbreviations(text) {
	if (!text || typeof text !== "string") return text;
	return text.replace(abbreviationPattern, (match) => {
		const lowerMatch = match.toLowerCase();
		for (const key of abbreviationKeys) {
			if (lowerMatch.startsWith(key.toLowerCase())) {
				return abbreviations[key].eng;
			}
		}
		return match;
	});
}

export function scanForTerms(text) {
	if (!text || typeof text !== "string") return [];

	const foundTerms = new Map();

	// Reset lastIndex because we are using a global regex
	termPattern.lastIndex = 0;

	// Split text into lines (potential paragraphs)
	// We split by any newline sequence to catch all lines
	const lines = text.split(/\r?\n/);

	let paragraphIndex = 0;

	lines.forEach((line) => {
		const trimmed = line.trim();
		if (!trimmed) return;

		// All non-empty lines are counted as "paragraphs" (or indexed items) to match refined Markdown.js logic.
		// Markdown.js converts single newlines to Paragraph breaks, so each line becomes a p (or h/etc).
		// Containers (ul, ol, blockquote) are no longer indexed in Markdown.js, so line-by-line counting works.

		paragraphIndex++;
		const currentParagraphNumber = paragraphIndex;

		// Clean text similar to Markdown.js
		let cleanText = line;
		cleanText = cleanText.replace(/\u00A0/g, " ");
		cleanText = cleanText.replace(/\u200B/g, "");

		// Use matchAll to avoid modifying termPattern.lastIndex
		const matches = [...cleanText.matchAll(termPattern)];

		for (const match of matches) {
			const term = match[0];
			const start = match.index;

			if (shouldSkipGlossaryTerm(term, cleanText, start)) {
				continue;
			}

			const lowerTerm = term.toLowerCase();
			if (glossary[lowerTerm]) {
				if (!foundTerms.has(lowerTerm)) {
					foundTerms.set(lowerTerm, {
						...glossary[lowerTerm],
						paragraphs: new Set(),
					});
				}
				foundTerms.get(lowerTerm).paragraphs.add(currentParagraphNumber);
			}
		}
	});

	// Convert Map to Array and sort by term name
	return Array.from(foundTerms.entries())
		.map(([key, entry]) => ({
			term: key,
			...entry,
			paragraphs: Array.from(entry.paragraphs).sort((a, b) => a - b),
		}))
		.sort((a, b) => a.term.localeCompare(b.term));
}

export const PHASE_COLORS = {
	root: "#ffffff",
	one: "#fff59d",
	two: "#90caf9",
	three: "#ef9a9a",
	four: "#a5d6a7",
};

export const getStyleInfo = (style) => {
	if (!style) return null;
	if (typeof style === "string") {
		return { category: style };
	}
	return {
		category: style.category,
		phase: style.phase,
	};
};
