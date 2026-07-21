import { LibraryTagKeys } from "@views/Library/Icons";

const FALLBACK_TRANSCRIPTION_LABELS = [
	"transcriptions",
	"תמלולים",
	"transcrições",
];

function isRemovedTranscriptionsFilter(filter, transcriptionLabels) {
	if (typeof filter === "string") {
		return transcriptionLabels.has(filter.toLowerCase());
	}
	if (filter?.id === "TRANSCRIPTIONS") return true;
	return (
		filter?.type === "source" &&
		transcriptionLabels.has(String(filter.label || "").toLowerCase())
	);
}

/** Drop retired Transcriptions source filters from persisted Research state. */
export function sanitizeResearchFilterTags(filterTags = [], translations = {}) {
	const transcriptionLabels = new Set(FALLBACK_TRANSCRIPTION_LABELS);
	if (translations.TRANSCRIPTIONS) {
		transcriptionLabels.add(String(translations.TRANSCRIPTIONS).toLowerCase());
	}
	return filterTags.filter(
		(filter) => !isRemovedTranscriptionsFilter(filter, transcriptionLabels),
	);
}

function groupResearchFilters(tags) {
	return tags.reduce((result, filter) => {
		const type =
			typeof filter === "string" ? "legacy" : filter.type || "legacy";
		(result[type] ||= []).push(filter);
		return result;
	}, {});
}

function matchSingleResearchFilter(doc, filter, translations) {
	const filterLabel = typeof filter === "string" ? filter : filter.label;
	const filterType = typeof filter === "string" ? null : filter.type;

	if (filterType === "source") {
		if (filterLabel === translations.SESSIONS) return doc.isSession;
		if (filterLabel === translations.ARTICLES) return !doc.isSession;
		if (filterLabel === translations.SUMMARIES) {
			if (!doc.isSession) return false;
			if (doc.summaryText || doc.summary) return true;
			// Pre-filter docs may not know yet; keep them as I/O candidates.
			return doc.summaryUnknown === true;
		}
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
}

function matchesResearchFilterGroups(doc, groups, translations) {
	return Object.values(groups).every((filters) =>
		filters.some((filter) =>
			matchSingleResearchFilter(doc, filter, translations),
		),
	);
}

/** Whether a result doc matches the given Research filter chips. */
export function docMatchesResearchFilters(
	doc,
	appliedFilterTags,
	translations,
) {
	const tags = sanitizeResearchFilterTags(appliedFilterTags, translations);
	if (!tags.length) return true;
	return matchesResearchFilterGroups(
		doc,
		groupResearchFilters(tags),
		translations,
	);
}

/**
 * Build a lightweight doc shape from an indexed file id so filters can be
 * evaluated before paragraph I/O.
 */
export function buildResearchFilterDocFromFileId(
	fileId,
	{ libraryTagsById, sessionsById = new Map() } = {},
) {
	if (!fileId) return null;
	const id = String(fileId);
	if (id.startsWith("session|")) {
		const parts = id.split("|");
		if (parts.length < 5) return null;
		const session = sessionsById.get(id) || {
			group: parts[1],
			year: parts[2],
			date: parts[3],
			name: parts.slice(4).join("|"),
		};
		const summaryText =
			session.summaryText || session.summary || session.description;
		return {
			...session,
			isSession: true,
			tag: { title: session.name, _id: id },
			summaryText,
			summary: session.summary,
			description: session.description,
			summaryUnknown: !summaryText,
		};
	}

	const tag =
		libraryTagsById instanceof Map
			? libraryTagsById.get(id)
			: (libraryTagsById || []).find((t) => t._id === id);
	if (!tag) return null;
	return { isSession: false, tag };
}

/**
 * File indices in indexData.f that match filterTags (metadata only).
 * Returns null when filters are empty (all files allowed).
 */
export function getAllowedResearchFileIndices(
	indexData,
	filterTags,
	translations,
	{ libraryTags = [], sessionsById = new Map() } = {},
) {
	const tags = sanitizeResearchFilterTags(filterTags, translations);
	if (!tags.length || !indexData?.f) return null;

	const libraryTagsById = new Map(libraryTags.map((t) => [t._id, t]));
	const groups = groupResearchFilters(tags);
	const allowed = new Set();

	for (let i = 0; i < indexData.f.length; i++) {
		const doc = buildResearchFilterDocFromFileId(indexData.f[i], {
			libraryTagsById,
			sessionsById,
		});
		if (doc && matchesResearchFilterGroups(doc, groups, translations)) {
			allowed.add(i);
		}
	}
	return allowed;
}

export function filterResearchResults(
	results,
	appliedFilterTags,
	translations,
) {
	const tags = sanitizeResearchFilterTags(appliedFilterTags, translations);
	if (!tags.length) return results;
	const groups = groupResearchFilters(tags);
	return results.filter((doc) =>
		matchesResearchFilterGroups(doc, groups, translations),
	);
}
