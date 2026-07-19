const TOKEN_PATTERN = /[a-z0-9\u0590-\u05FF]+/gi;

function tokenize(value) {
	return (value.match(TOKEN_PATTERN) || []).map((term) => term.toLowerCase());
}

/**
 * Parse the small query language used by Research. Unquoted words are ANDed,
 * quoted text stays together as a phrase, and OR creates alternative groups.
 */
export function parseResearchQuery(query = "") {
	return query
		.split(/\s+OR\s+/i)
		.map((group) => {
			const clauses = [];
			const matcher = /"([^\"]+)"|([^\"]+)/g;
			let match;
			while ((match = matcher.exec(group))) {
				const segment = match[1] ?? match[2];
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
		.filter((group) => group.length);
}

export function getSearchTerms(query) {
	return [
		...new Set(
			parseResearchQuery(query).flatMap((group) =>
				group.flatMap((c) => c.terms),
			),
		),
	];
}

function termMatchesText(term, text) {
	const normalized = String(text || "").toLowerCase();
	if (/^[a-z0-9]+$/i.test(term)) {
		const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
		return new RegExp(`\\b${escaped}\\b`, "i").test(normalized);
	}
	return normalized.includes(term);
}

export function clauseMatchesText(clause, text) {
	if (!clause.terms.length) return true;
	if (!clause.phrase) return termMatchesText(clause.terms[0], text);
	const normalized = String(text || "").toLowerCase();
	const expression = clause.terms
		.map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
		.join("[^a-z0-9\\u0590-\\u05FF]+");
	return new RegExp(expression, "i").test(normalized);
}

export function rankResearchResults(results, query) {
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

export function getResearchSuggestions({
	query,
	filters = [],
	titles = [],
	terms = [],
}) {
	const needle = String(query || "")
		.trim()
		.toLowerCase();
	if (needle.length < 2) return [];
	const matches = (value) =>
		String(value || "")
			.toLowerCase()
			.includes(needle);
	const unique = new Set();
	const add = (suggestion) => {
		const key = `${suggestion.kind}:${suggestion.value || suggestion.label}`;
		if (!unique.has(key)) unique.add(key);
	};
	const suggestions = [];
	titles
		.filter(matches)
		.slice(0, 4)
		.forEach((label) => {
			const item = { kind: "title", label, value: `"${label}"` };
			add(item);
			suggestions.push(item);
		});
	filters
		.filter((filter) => matches(filter.label))
		.slice(0, 4)
		.forEach((filter) => {
			const item = { kind: "filter", label: filter.label, filter };
			add(item);
			suggestions.push(item);
		});
	terms
		.filter(matches)
		.slice(0, 4)
		.forEach((label) => {
			const item = { kind: "term", label, value: label };
			add(item);
			suggestions.push(item);
		});
	return suggestions.filter(
		(item, index, all) =>
			all.findIndex(
				(other) =>
					`${other.kind}:${other.value || other.label}` ===
					`${item.kind}:${item.value || item.label}`,
			) === index,
	);
}
