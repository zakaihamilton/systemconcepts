import {
	authenticateTokenRequest,
	enforceRateLimit,
	getNonNegativeInt,
	getPositiveInt,
	JSON_HEADERS,
	NO_CACHE_HEADERS,
} from "@util/api/api";
import { logger as structuredLogger } from "@util/api/logger";
import {
	getSessions,
	getSProxyUrl,
	getTranscriptProxyUrlFast,
	sortSessions,
} from "@util/domain/sessionFeed";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const SESSION_CACHE_HEADERS = {
	"Cache-Control": "private, max-age=300",
	"Vercel-CDN-Cache-Control":
		"public, max-age=300, stale-while-revalidate=3600",
};

function preventCaching(response) {
	for (const [name, value] of Object.entries(NO_CACHE_HEADERS)) {
		response.headers.set(name, value);
	}
	return response;
}

export async function GET(request) {
	try {
		const rateLimitResponse = await enforceRateLimit(request, {
			limit: 60,
			windowMs: 60 * 1000,
		});
		if (rateLimitResponse) return preventCaching(rateLimitResponse);

		const { searchParams } = new URL(request.url);
		const user = await authenticateTokenRequest(searchParams);
		if (!user) {
			return NextResponse.json(
				{ err: "Unauthorized. Access denied." },
				{
					status: 403,
					headers: { ...JSON_HEADERS, ...NO_CACHE_HEADERS },
				},
			);
		}

		const group = searchParams.get("group");
		const tag = searchParams.get("tag");
		const date = searchParams.get("date");
		const year = searchParams.get("year");
		const query = searchParams.get("query");
		const count = getPositiveInt(searchParams.get("count"), 100, 500);
		const index = getNonNegativeInt(searchParams.get("index"));

		let sessions = await getSessions({ group });
		if (tag) {
			const lowerTag = tag.toLowerCase().trim();
			sessions = sessions.filter((s) =>
				(s.tags || []).some((t) => t.toLowerCase().trim() === lowerTag),
			);
		}
		if (date) {
			const dateStr = date.trim();
			sessions = sessions.filter((s) => s.date === dateStr);
		}
		if (year) {
			const yearStr = year.trim();
			sessions = sessions.filter((s) => s.year === yearStr);
		}
		if (query) {
			const lowerQuery = query.toLowerCase().trim();
			sessions = sessions.filter(
				(s) =>
					(s.name || "").toLowerCase().includes(lowerQuery) ||
					(s.summaryText || "").toLowerCase().includes(lowerQuery) ||
					(s.tags || []).some((t) => t.toLowerCase().includes(lowerQuery)),
			);
		}

		sessions = sortSessions(sessions).slice(index, index + count);
		const baseUrl =
			process.env.NEXT_PUBLIC_SITE_URL || "https://systemconcepts.app";

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

		return new Response(JSON.stringify(formattedSessions), {
			status: 200,
			headers: {
				...JSON_HEADERS,
				...SESSION_CACHE_HEADERS,
			},
		});
	} catch (err) {
		structuredLogger.error("[API] Error generating session list:", err);
		return new NextResponse(
			JSON.stringify({ err: "Error generating sessions JSON API" }),
			{
				status: 500,
				headers: {
					"Content-Type": "application/json",
					...NO_CACHE_HEADERS,
				},
			},
		);
	}
}
