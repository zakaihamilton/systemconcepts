/**
 * Content parsers for extracting tag values from article text
 */

/**
 * Extract article number from text
 * Matches patterns like:
 * - "Article No. 9"
 * - "Article Number 9"
 * - "Article #9"
 * - "No. 123"
 */
export function extractNumber(text) {
    if (!text) return null;

    // Look at the first few lines where article info typically appears
    const firstPart = text.slice(0, 500);

    // Pattern: "Article No. X" or "Article Number X" or "Article X" or "No. X"
    const patterns = [
        /Article\s+No\.?\s*(\d+)/i,
        /Article\s+Number\s*(\d+)/i,
        /Article\s+#(\d+)/i,
        /^Article\s+(\d+)/im,              // "Article 10" at start of line
        /^No\.?\s*(\d+)/im,
        /\bNo\.?\s*(\d+),?\s+\d{4}/i  // "No. 9, 1984" pattern
    ];

    for (const pattern of patterns) {
        const match = firstPart.match(pattern);
        if (match) {
            return match[1];
        }
    }

    return null;
}

/**
 * Extract year from text
 * Matches patterns like:
 * - "1984"
 * - Hebrew year formats like "Tav-Shin-Mem-Dalet" (תשמ"ד = 5744 = 1984)
 */
export function extractYear(text) {
    if (!text) return null;

    const firstPart = text.slice(0, 500);

    // Hebrew year mappings (common ones)
    const hebrewYears = {
        'tav-shin-mem-dalet': '1984',
        'tav-shin-mem-he': '1985',
        'tav-shin-mem-vav': '1986',
        'tav-shin-mem-zayin': '1987',
        'tav-shin-mem-chet': '1988',
        'tav-shin-mem-tet': '1989',
        'tav-shin-nun': '1990',
        'tav-shin-nun-aleph': '1991',
        'tav-shin-nun-bet': '1992',
        'tav-shin-nun-gimel': '1993',
        'tav-shin-nun-dalet': '1994',
        'tav-shin-nun-he': '1995'
    };

    // Check for Hebrew year format
    const lowerText = firstPart.toLowerCase();
    for (const [hebrew, year] of Object.entries(hebrewYears)) {
        if (lowerText.includes(hebrew)) {
            return year;
        }
    }

    // Pattern: standalone 4-digit year (19xx or 20xx)
    const yearMatch = firstPart.match(/\b(19[5-9]\d|20[0-2]\d)\b/);
    if (yearMatch) {
        return yearMatch[1];
    }

    return null;
}

/**
 * Analyze content and return suggested values for missing tags
 * @param {string} text - Article content
 * @param {object} existingTags - Current tag values
 * @returns {object} Suggested values for each tag field
 */
export function analyzeContent(text, existingTags = {}) {
    const suggestions = {};

    // Extract number if not already set
    const extractedNumber = extractNumber(text);
    if (extractedNumber && !existingTags.number) {
        suggestions.number = extractedNumber;
    }

    // Extract year if not already set
    const extractedYear = extractYear(text);
    if (extractedYear && !existingTags.year) {
        suggestions.year = extractedYear;
    }

    return suggestions;
}

/**
 * Get all available parsers with metadata
 * @returns {Array} Parser definitions
 */
export function getAvailableParsers() {
    return [
        {
            field: 'number',
            name: 'Article Number',
            description: 'Extracts from patterns like "Article No. 9"',
            extract: extractNumber
        },
        {
            field: 'year',
            name: 'Year',
            description: 'Extracts from years like "1984" or Hebrew years',
            extract: extractYear
        }
    ];
}
