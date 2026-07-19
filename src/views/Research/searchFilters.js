import { LibraryTagKeys } from "@views/Library/Icons";

export function filterResearchResults(
	results,
	appliedFilterTags,
	translations,
) {
	if (!appliedFilterTags.length) return results;
	const groups = appliedFilterTags.reduce((result, filter) => {
		const type =
			typeof filter === "string" ? "legacy" : filter.type || "legacy";
		(result[type] ||= []).push(filter);
		return result;
	}, {});
	return results.filter((doc) =>
		Object.values(groups).every((filters) =>
			filters.some((filter) => {
				const filterLabel = typeof filter === "string" ? filter : filter.label;
				const filterType = typeof filter === "string" ? null : filter.type;

				if (filterType === "source") {
					if (filterLabel === translations.SESSIONS) return doc.isSession;
					if (filterLabel === translations.ARTICLES) return !doc.isSession;
					if (filterLabel === translations.SUMMARIES)
						return doc.isSession && Boolean(doc.summaryText || doc.summary);
					if (filterLabel === translations.TRANSCRIPTIONS)
						return doc.isSession && Boolean(doc.transcription);
				}

				if (doc.isSession) {
					const label = String(filterLabel).toLowerCase();
					if (filterType === "group")
						return String(doc.group).toLowerCase() === label;
					if (filterType === "year") return String(doc.year) === filterLabel;
					if (filterType === "date") return doc.date === filterLabel;
					if (filterType === "type")
						return String(doc.type).toLowerCase() === label;
					return false;
				}

				if (filterType && doc.tag?.[filterType]) {
					return (
						String(doc.tag[filterType]).toLowerCase() ===
						String(filterLabel).toLowerCase()
					);
				}
				return LibraryTagKeys.some((key) => {
					const value = doc.tag?.[key];
					return (
						value &&
						String(value).trim().toLowerCase() ===
							String(filterLabel).toLowerCase()
					);
				});
			}),
		),
	);
}
