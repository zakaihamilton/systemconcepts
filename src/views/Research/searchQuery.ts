import type {
	ResearchDocument,
	ResearchFilter,
	ResearchQueryClause,
	ResearchSuggestion,
	ResearchTagMetadata,
} from "./types";

const TOKEN_PATTERN = /[a-z0-9\u0590-\u05FF]+/gi;

function tokenize(value: string) {
	return (value.match(TOKEN_PATTERN) || []).map((term) => term.toLowerCase());
}

/**
 * Parse the small query language used by Research. Unquoted words are ANDed,
 * quoted text stays together as a phrase, and OR creates alternative groups.
 */
export function parseResearchQuery(query = ""): ResearchQueryClause[][] {
	return query
		.split(/\s+OR\s+/i)
		.map((group) => {
			const clauses: ResearchQueryClause[] = [];
			const matcher = /"([^\"]+)"|([^\"]+)/g;
			let match: RegExpExecArray | null;
			while ((match = matcher.exec(group))) {
				const segment = match[1] ?? match[2] ?? "";
				const parts =
					match[1] !== undefined ? [segment] : segment.split(/\s+AND\s+/i);
				for (const part of parts) {
					const terms = tokenize(part);
					if (!terms.length) continue;
					if (match[1] !== undefined) {
						clauses.push({ raw: part.trim(), terms, phrase: true });
					} else {
						terms.forEach((term) =>
							clauses.push({ raw: term, terms: [term], phrase: false }),
						);
					}
				}
			}
			return clauses;
		})
		.filter((group) => group.length > 0);
}

export function getSearchTerms(query: string) {
	return [
		...new Set(
			parseResearchQuery(query).flatMap((group) =>
				group.flatMap((clause) => clause.terms),
			),
		),
	];
}

function termMatchesText(term: string, text: string) {
	const normalized = String(text || "").toLowerCase();
	if (/^[a-z0-9]+$/i.test(term)) {
		const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
		return new RegExp(`\\b${escaped}\\b`, "i").test(normalized);
	}
	return normalized.includes(term);
}

export function clauseMatchesText(clause: ResearchQueryClause, text: string) {
	if (!clause.terms.length) return true;
	if (!clause.phrase) return termMatchesText(clause.terms[0], text);
	const normalized = String(text || "").toLowerCase();
	const expression = clause.terms
		.map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
		.join("[^a-z0-9\\u0590-\\u05FF]+");
	return new RegExp(expression, "i").test(normalized);
}

type ResearchSearchCandidate = ResearchDocument & {
	tag?: ResearchTagMetadata;
	matches?: Array<Partial<{ index: number; text: string }>>;
};

export function rankResearchResults<T extends ResearchSearchCandidate>(
	results: readonly T[],
	query: string,
): T[] {
	const queryTerms = getSearchTerms(query);
	const quotedPhrases = parseResearchQuery(query)
		.flat()
		.filter((clause) => clause.phrase);

	return [...results]
		.map((doc) => {
			const title = String(doc.tag?.title || doc.name || "").toLowerCase();
			const titleTermCount = queryTerms.filter((term) =>
				termMatchesText(term, title),
			).length;
			const phraseCount = quotedPhrases.filter((phrase) =>
				clauseMatchesText(phrase, title),
			).length;
			return {
				doc,
				score:
					phraseCount * 100 + titleTermCount * 20 + (doc.matches?.length || 0),
			};
		})
		.sort(
			(a, b) =>
				b.score - a.score ||
				(b.doc.matches?.length || 0) - (a.doc.matches?.length || 0) ||
				String(a.doc.tag?.title || a.doc.name || "").localeCompare(
					String(b.doc.tag?.title || b.doc.name || ""),
				),
		)
		.map(({ doc }) => doc);
}

interface ResearchSuggestionOptions {
	query?: string;
	filters?: ResearchFilter[];
	titles?: Array<string | null>;
	terms?: Array<string | null>;
}

export function getResearchSuggestions({
	query,
	filters = [],
	titles = [],
	terms = [],
}: ResearchSuggestionOptions): ResearchSuggestion[] {
	const needle = String(query || "")
		.trim()
		.toLowerCase();
	if (needle.length < 2) return [];
	const matches = (value: unknown) =>
		String(value || "")
			.toLowerCase()
			.includes(needle);
	const unique = new Set<string>();
	const suggestions: ResearchSuggestion[] = [];
	const add = (suggestion: ResearchSuggestion) => {
		const key = `${suggestion.kind}:${suggestion.value || suggestion.label}`;
		if (unique.has(key)) return false;
		unique.add(key);
		return true;
	};

	titles
		.filter(matches)
		.slice(0, 4)
		.forEach((label) => {
			const suggestion: ResearchSuggestion = {
				kind: "title",
				label,
				value: `"${label}"`,
			};
			if (add(suggestion)) suggestions.push(suggestion);
		});
	filters
		.filter((filter) =>
			matches(typeof filter === "string" ? filter : filter.label),
		)
		.slice(0, 4)
		.forEach((filter) => {
			const suggestion: ResearchSuggestion = {
				kind: "filter",
				label: typeof filter === "string" ? filter : filter.label,
				filter,
			};
			if (add(suggestion)) suggestions.push(suggestion);
		});
	terms
		.filter(matches)
		.slice(0, 4)
		.forEach((label) => {
			const suggestion: ResearchSuggestion = {
				kind: "term",
				label,
				value: label ?? "",
			};
			if (add(suggestion)) suggestions.push(suggestion);
		});
	return suggestions;
}
