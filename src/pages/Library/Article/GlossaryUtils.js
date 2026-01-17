
import { glossary } from './Glossary';

// Create the regex once since glossary is constant
// Sort keys by length descending to ensure multi-word terms (e.g. "hitpashtut aleph") are matched before single words
const sortedKeys = Object.keys(glossary).sort((a, b) => b.length - a.length);
// Escape special characters in keys to prevent regex errors
const escapedKeys = sortedKeys.map(key => key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
export const termPattern = new RegExp(`\\b(${escapedKeys.join('|')})\\b`, 'gi');

export function scanForTerms(text) {
    if (!text || typeof text !== 'string') return [];

    const foundTerms = new Map();
    let match;

    // Reset lastIndex because we are using a global regex
    termPattern.lastIndex = 0;

    // Clean text similar to Markdown.js (optional but recommended for accuracy)
    let cleanText = text;
    cleanText = cleanText.replace(/\u00A0/g, ' ');
    cleanText = cleanText.replace(/\u200B/g, '');

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
            foundTerms.set(lowerTerm, glossary[lowerTerm]);
        }
    }

    // Convert Map to Array and sort by term name
    return Array.from(foundTerms.entries())
        .map(([key, entry]) => ({ term: key, ...entry }))
        .sort((a, b) => a.term.localeCompare(b.term));
}
