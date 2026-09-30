import { glossary } from "@data/glossary";

import { wordToNumber } from "@util/data/numberWords";

// Reference pattern to detect cross-references like "Inner Reflection Chapter Nine, item 33"
// Matches: [Optional Section Name] Chapter [number/word], item [number]
export const referencePattern =
	/(?:([A-Z][A-Za-z]+(?:\s+(?:[A-Z][A-Za-z]+|of|the|in|and))*)\s+)?Chapter\s+(\w+)(?:,?\s*item\s+(\d+))?/g;

// Find an article by partial tag matching
export const findArticleByReference = (
	tags: any,
	sectionName: any,
	chapterName: any,
	currentTag: any,
) => {
	if (!tags || !Array.isArray(tags)) return null;

	// Clean up the section name (remove trailing " in" which might be captured)
	let cleanSection = sectionName ? sectionName.trim() : null;
	if (cleanSection && cleanSection.toLowerCase().endsWith(" in")) {
		cleanSection = cleanSection.slice(0, -3).trim();
	}

	const normalizedSection = cleanSection ? cleanSection.toLowerCase() : null;
	const normalizedChapter = chapterName ? chapterName.toLowerCase().trim() : "";

	// Convert word to number if applicable
	const chapterAsNumber =
		wordToNumber[normalizedChapter] || parseInt(normalizedChapter, 10);

	// Resolve section aliases from glossary
	const sectionAliases: any = [];
	if (normalizedSection) {
		sectionAliases.push(normalizedSection);
		const glossaryEntry = glossary[normalizedSection];
		if (glossaryEntry) {
			if (glossaryEntry.en) sectionAliases.push(glossaryEntry.en.toLowerCase());
			if (glossaryEntry.trans)
				sectionAliases.push(glossaryEntry.trans.toLowerCase());
		}
	} else if (currentTag?.section) {
		// Default to current section if not specified
		sectionAliases.push(currentTag.section.toLowerCase());
	}

	// Look for matching article
	return tags.find((tag) => {
		// Book Constraint: Must be in the same book
		if (currentTag?.book && tag.book && tag.book !== currentTag.book) {
			return false;
		}

		// Check if section matches (partial match)
		const tagSection = (tag.section || "").toLowerCase();

		// Must have a section tag to match against
		if (!tagSection) return false;
		// Check match against any known alias of the section name
		const sectionMatch: any = sectionAliases.some(
			(alias: any) => tagSection.includes(alias) || alias.includes(tagSection),
		);

		if (!sectionMatch) {
			return false;
		}

		// Check if chapter matches (word or number)
		const tagChapter = (tag.chapter || "").toLowerCase();

		// If the tag has no chapter, it cannot match a specific chapter request
		if (!tagChapter && normalizedChapter) {
			return false;
		}

		const tagChapterNumber =
			wordToNumber[tagChapter.replace(/chapter\s+/i, "").trim()] ||
			parseInt(tagChapter.replace(/\D/g, ""), 10);

		if (
			tagChapter.includes(normalizedChapter) ||
			(tagChapter &&
				normalizedChapter.includes(
					tagChapter.replace(/chapter\s+/i, "").trim(),
				))
		) {
			// Match same part if current tag has a part
			if (currentTag?.part && tag.part && tag.part !== currentTag.part) {
				return false;
			}
			return true;
		}

		if (
			!isNaN(chapterAsNumber) &&
			!isNaN(tagChapterNumber) &&
			chapterAsNumber === tagChapterNumber
		) {
			// Match same part if current tag has a part
			if (currentTag?.part && tag.part && tag.part !== currentTag.part) {
				return false;
			}
			return true;
		}

		return false;
	});
};
