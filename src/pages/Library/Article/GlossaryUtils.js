
import { glossary } from '@data/glossary';
import { abbreviations } from '@data/abbreviations';

// Create the regex once since glossary is constant
// Sort keys by length descending to ensure multi-word terms (e.g. "hitpashtut aleph") are matched before single words
const sortedKeys = Object.keys(glossary).sort((a, b) => b.length - a.length);
// Escape special characters in keys to prevent regex errors
const escapedKeys = sortedKeys.map(key => key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
export const termPattern = new RegExp(`\\b(${escapedKeys.join('|')})\\b`, 'gi');

// Create abbreviation regex
const abbreviationKeys = Object.keys(abbreviations).sort((a, b) => b.length - a.length);
const abbreviationPatterns = abbreviationKeys.map(key => {
    const expansion = abbreviations[key];
    const escapedExpansion = expansion.eng.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return `\\b${key}\\b(?:\\s*\\(${escapedExpansion}\\))?`;
});
export const abbreviationPattern = new RegExp(`(${abbreviationPatterns.join('|')})`, 'gi');

export function replaceAbbreviations(text) {
    if (!text || typeof text !== 'string') return text;
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
    if (!text || typeof text !== 'string') return [];

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

        // Determine if this line is a "Paragraph" that gets an index in the UI
        // Logic must match Markdown.js rendering behavior

        let isParagraph = true;

        // 1. Check for Explicit Headers (#)
        if (/^#+\s/.test(trimmed)) {
            isParagraph = false;
        }

        // 2. Check for Bullet Lists (*, -, +). Note: Numbered lists are converted to paragraphs in Markdown.js, so they COUNT.
        // We ensure it's a list marker followed by space
        else if (/^[\*\-\+]\s/.test(trimmed)) {
            isParagraph = false;
        }

        // 3. Check for Heuristic Headers (matches Markdown.js logic)
        // Start of line, Uppercase, No period at end, < 80 chars
        // Negative lookahead for #, -, *, digit to ensure not already a header or list
        else if (/^(?!#|-|\*|\d)(?=[A-Z])(.*?)(?:\r?\n|$)/.test(line)) {
            // Strictly check the same conditions as Markdown.js
            if (!trimmed.endsWith('.') && trimmed.length <= 80) {
                isParagraph = false;
            }
        }

        if (!isParagraph) {
            // If it's not a paragraph (e.g. Header), we skip associating it with a number
            // because the UI doesn't assign indices to headers, so we can't jump to them.
            return;
        }

        paragraphIndex++;
        const currentParagraphNumber = paragraphIndex;

        // Clean text similar to Markdown.js
        let cleanText = line;
        cleanText = cleanText.replace(/\u00A0/g, ' ');
        cleanText = cleanText.replace(/\u200B/g, '');

        // Reset regex for each line
        termPattern.lastIndex = 0;
        let match;

        while ((match = termPattern.exec(cleanText)) !== null) {
            const term = match[0];
            const start = match.index;

            // Skip lowercase 'or'
            if (term === 'or') {
                continue;
            }
            // Skip 'Or' at the start of a sentence
            if (term === 'Or') {
                const isStartOfSentence = (start === 0) || /[\.\!\?]\s+$/.test(cleanText.slice(0, start));
                if (isStartOfSentence) {
                    continue;
                }
            }

            const lowerTerm = term.toLowerCase();
            if (glossary[lowerTerm]) {
                if (!foundTerms.has(lowerTerm)) {
                    foundTerms.set(lowerTerm, { ...glossary[lowerTerm], paragraphs: new Set() });
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
            paragraphs: Array.from(entry.paragraphs).sort((a, b) => a - b)
        }))
        .sort((a, b) => a.term.localeCompare(b.term));
}

export const PHASE_COLORS = {
    root: '#ffffff',
    one: '#fff59d',
    two: '#90caf9',
    three: '#ef9a9a',
    four: '#a5d6a7'
};

export const getStyleInfo = (style) => {
    if (!style) return null;
    if (typeof style === 'string') {
        return { category: style };
    }
    return {
        category: style.category,
        phase: style.phase
    };
};
