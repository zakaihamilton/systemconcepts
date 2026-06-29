import {
	getSProxyUrl,
	getTranscriptProxyUrlFast,
	sortSessions,
} from "@util/domain/sessionFeedEdge";

function getPositiveInt(value, fallback, max) {
	const parsed = Number.parseInt(value || "", 10);
	const safe = Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
	return Math.min(safe, max);
}

function getNonNegativeInt(value, fallback = 0) {
	const parsed = Number.parseInt(value || "", 10);
	return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export function filterSessions(sessions, searchParams) {
	const tag = searchParams.get("tag");
	const date = searchParams.get("date");
	const year = searchParams.get("year");
	const query = searchParams.get("query");
	const count = getPositiveInt(searchParams.get("count"), 100, 500);
	const index = getNonNegativeInt(searchParams.get("index"));

	let filtered = sessions;
	if (tag) {
		const lowerTag = tag.toLowerCase().trim();
		filtered = filtered.filter((s) =>
			(s.tags || []).some((t) => t.toLowerCase().trim() === lowerTag),
		);
	}
	if (date) {
		const dateStr = date.trim();
		filtered = filtered.filter((s) => s.date === dateStr);
	}
	if (year) {
		const yearStr = year.trim();
		filtered = filtered.filter((s) => s.year === yearStr);
	}
	if (query) {
		const lowerQuery = query.toLowerCase().trim();
		filtered = filtered.filter(
			(s) =>
				(s.name || "").toLowerCase().includes(lowerQuery) ||
				(s.summaryText || "").toLowerCase().includes(lowerQuery) ||
				(s.tags || []).some((t) => t.toLowerCase().includes(lowerQuery)),
		);
	}

	return sortSessions(filtered).slice(index, index + count);
}

export function buildSessionsJson({ sessions, baseUrl }) {
	const formattedSessions = sessions.map((session) => ({
		id: session.id,
		group: session.group,
		year: session.year,
		date: session.date,
		name: session.name,
		duration: session.duration ? Math.round(session.duration) : 0,
		tags: session.tags || [],
		summaryText: session.summaryText || session.summary || null,
		imageUrl:
			session.image && session.image.path
				? getSProxyUrl(session.image.path, baseUrl)
				: null,
		transcriptionUrl: getTranscriptProxyUrlFast(session, baseUrl),
	}));

	return JSON.stringify(formattedSessions);
}
