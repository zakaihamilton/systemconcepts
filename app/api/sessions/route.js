import { JSON_HEADERS, NO_CACHE_HEADERS } from "@util/api/httpHeaders";
import { readApiCacheEdge } from "@util/api/apiCacheEdge";
import {
	buildApiCacheKey,
	getContentParams,
	getManifestFingerprint,
} from "@util/api/apiCacheKeys";
import {
	authenticateEdge,
	enforceRateLimitEdge,
	getClientIp,
	scheduleApiCacheWrite,
} from "@util/api/edgeApi";
import { logger as structuredLogger } from "@util/api/logger";
import {
	buildSessionsJson,
	filterSessions,
} from "@util/domain/sessionsApiResponse";
import { getSessions, loadManifest } from "@util/domain/sessionFeedEdge";
import { NextResponse } from "next/server";

export const runtime = "edge";
export const dynamic = "force-dynamic";

const SESSION_CACHE_HEADERS = {
	"Cache-Control": "public, max-age=300",
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
		const rateLimited = await enforceRateLimitEdge(getClientIp(request), {
			limit: 60,
			windowMs: 60 * 1000,
		});
		if (!rateLimited) {
			return preventCaching(
				NextResponse.json(
					{ err: "Too many requests. Please try again later." },
					{ status: 429, headers: { ...JSON_HEADERS, ...NO_CACHE_HEADERS } },
				),
			);
		}

		const { searchParams } = new URL(request.url);
		const authenticated = await authenticateEdge(searchParams);
		if (!authenticated) {
			return NextResponse.json(
				{ err: "Unauthorized. Access denied." },
				{
					status: 403,
					headers: { ...JSON_HEADERS, ...NO_CACHE_HEADERS },
				},
			);
		}

		const baseUrl =
			process.env.SITE_URL ||
			process.env.NEXT_PUBLIC_SITE_URL ||
			"https://systemconcepts.app";
		const group = searchParams.get("group");
		const manifest = await loadManifest();
		const fingerprint = getManifestFingerprint(manifest, { group });
		const contentParams = getContentParams("sessions", searchParams);
		const cacheKey = await buildApiCacheKey(
			"sessions",
			contentParams,
			fingerprint,
		);
		const cachedBody = await readApiCacheEdge("sessions", cacheKey);
		if (cachedBody) {
			return new Response(cachedBody, {
				status: 200,
				headers: {
					...JSON_HEADERS,
					...SESSION_CACHE_HEADERS,
				},
			});
		}

		const sessions = filterSessions(await getSessions({ group }), searchParams);
		const body = buildSessionsJson({ sessions, baseUrl });
		scheduleApiCacheWrite("sessions", cacheKey, body);

		return new Response(body, {
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
