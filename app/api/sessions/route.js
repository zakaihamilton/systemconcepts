import {
	authenticateTokenRequest,
	enforceRateLimit,
	getNonNegativeInt,
	getPositiveInt,
	JSON_HEADERS,
} from "@util/api";
import {
	getSProxyUrl,
	getSessions,
	getTranscriptProxyUrl,
	sortSessions,
} from "@util/sessionFeed";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request) {
	try {
		const rateLimitResponse = await enforceRateLimit(request, {
			limit: 60,
			windowMs: 60 * 1000,
		});
		if (rateLimitResponse) return rateLimitResponse;

		const { searchParams } = new URL(request.url);
		const user = await authenticateTokenRequest(searchParams);
		if (!user) {
			return NextResponse.json(
				{ err: "Unauthorized. Access denied." },
				{ status: 403, headers: JSON_HEADERS },
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

		const formattedSessions = await Promise.all(sessions.map(async (session) => {
			const transcriptionUrl = await getTranscriptProxyUrl(session, baseUrl);
			return {
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
				transcriptionUrl,
			};
		}));

		return new Response(JSON.stringify(formattedSessions), {
			status: 200,
			headers: {
				...JSON_HEADERS,
				"Cache-Control": "private, max-age=300, stale-while-revalidate=3600",
			},
		});
	} catch (err) {
		console.error("[API] Error generating session list:", err);
		return new NextResponse(
			JSON.stringify({ err: "Error generating sessions JSON API" }),
			{
				status: 500,
				headers: { "Content-Type": "application/json" },
			},
		);
	}
}
