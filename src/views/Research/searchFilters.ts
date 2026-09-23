import { LibraryTagKeys } from "@views/Library/Icons";
import type {
	ResearchDocument,
	ResearchFilter,
	ResearchLibraryTag,
	ResearchSearchIndex,
	ResearchSession,
	ResearchTranslations,
} from "./types";

const FALLBACK_TRANSCRIPTION_LABELS = [
	"transcriptions",
	"תמלולים",
	"transcrições",
];

function isRemovedTranscriptionsFilter(
	filter: ResearchFilter,
	transcriptionLabels: ReadonlySet<string>,
) {
	if (typeof filter === "string") {
		return transcriptionLabels.has(filter.toLowerCase());
	}
	if (filter.id === "TRANSCRIPTIONS") return true;
	return (
		filter.type === "source" &&
		transcriptionLabels.has(String(filter.label || "").toLowerCase())
	);
}

/** Drop retired Transcriptions source filters from persisted Research state. */
export function sanitizeResearchFilterTags(
	filterTags: ResearchFilter[] = [],
	translations: ResearchTranslations = {},
) {
	const transcriptionLabels = new Set(FALLBACK_TRANSCRIPTION_LABELS);
	if (translations.TRANSCRIPTIONS) {
		transcriptionLabels.add(translations.TRANSCRIPTIONS.toLowerCase());
	}
	return filterTags.filter(
		(filter) => !isRemovedTranscriptionsFilter(filter, transcriptionLabels),
	);
}

function groupResearchFilters(tags: ResearchFilter[]) {
	return tags.reduce<Record<string, ResearchFilter[]>>((groups, filter) => {
		const type =
			typeof filter === "string" ? "legacy" : filter.type || "legacy";
		(groups[type] ||= []).push(filter);
		return groups;
	}, {});
}

interface ResearchFilterDocument extends ResearchDocument {
	tag?: ResearchLibraryTag | ResearchDocument["tag"];
}

function matchSingleResearchFilter(
	doc: ResearchFilterDocument,
	filter: ResearchFilter,
	translations: ResearchTranslations,
) {
	const filterLabel = typeof filter === "string" ? filter : filter.label || "";
	const filterType = typeof filter === "string" ? undefined : filter.type;

	if (filterType === "source") {
		if (filterLabel === translations.SESSIONS) return doc.isSession === true;
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
		if (filterType === "type") return String(doc.type).toLowerCase() === label;
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
			value != null &&
			String(value).trim().toLowerCase() === String(filterLabel).toLowerCase()
		);
	});
}

function matchesResearchFilterGroups(
	doc: ResearchFilterDocument,
	groups: Record<string, ResearchFilter[]>,
	translations: ResearchTranslations,
) {
	return Object.values(groups).every((filters) =>
		filters.some((filter) =>
			matchSingleResearchFilter(doc, filter, translations),
		),
	);
}

/** Whether a result doc matches the given Research filter chips. */
export function docMatchesResearchFilters(
	doc: ResearchFilterDocument,
	appliedFilterTags: ResearchFilter[] = [],
	translations: ResearchTranslations = {},
) {
	const tags = sanitizeResearchFilterTags(appliedFilterTags, translations);
	if (!tags.length) return true;
	return matchesResearchFilterGroups(
		doc,
		groupResearchFilters(tags),
		translations,
	);
}

type ResearchSessionsById = Map<string, ResearchSession>;
type ResearchLibraryTagsById =
	| Map<string, ResearchLibraryTag>
	| ResearchLibraryTag[];

interface ResearchFilterContext {
	libraryTagsById?: ResearchLibraryTagsById;
	sessionsById?: ResearchSessionsById;
}

/**
 * Build a lightweight doc shape from an indexed file id so filters can be
 * evaluated before paragraph I/O.
 */
export function buildResearchFilterDocFromFileId(
	fileId: string | null | undefined,
	{
		libraryTagsById,
		sessionsById = new Map<string, ResearchSession>(),
	}: ResearchFilterContext = {},
): ResearchFilterDocument | null {
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
			session.summaryText ||
			(typeof session.summary === "string" ? session.summary : undefined) ||
			session.description;
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
			: (libraryTagsById || []).find((item) => item._id === id);
	if (!tag) return null;
	return { isSession: false, tag };
}

/**
 * File indices in indexData.f that match filterTags (metadata only).
 * Returns null when filters are empty (all files allowed).
 */
export function getAllowedResearchFileIndices(
	indexData: Pick<ResearchSearchIndex, "f"> | null | undefined,
	filterTags: ResearchFilter[] = [],
	translations: ResearchTranslations = {},
	{
		libraryTags = [],
		sessionsById = new Map<string, ResearchSession>(),
	}: {
		libraryTags?: ResearchLibraryTag[];
		sessionsById?: ResearchSessionsById;
	} = {},
): Set<number> | null {
	const tags = sanitizeResearchFilterTags(filterTags, translations);
	if (!tags.length || !indexData?.f) return null;

	const libraryTagsById = new Map(
		libraryTags.map((tag) => [tag._id, tag] as const),
	);
	const groups = groupResearchFilters(tags);
	const allowed = new Set<number>();

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

export function filterResearchResults<T extends ResearchFilterDocument>(
	results: T[],
	appliedFilterTags: ResearchFilter[] = [],
	translations: ResearchTranslations = {},
): T[] {
	const tags = sanitizeResearchFilterTags(appliedFilterTags, translations);
	if (!tags.length) return results;
	const groups = groupResearchFilters(tags);
	return results.filter((doc) =>
		matchesResearchFilterGroups(doc, groups, translations),
	);
}
