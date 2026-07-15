/**
 * RSS feed endpoint — runs on Vercel Edge Runtime.
 * - Auth delegated to /api/rss/verify (Node.js runtime, MongoDB access)
 * - Shared S3 api-cache for cross-user response reuse
 * - S3 fetches via sessionFeedEdge (fetch + Web Crypto presigner)
 */

import { readApiCacheEdge } from "@util/api/apiCacheEdge";
import {
	buildApiCacheKey,
	buildCanonicalApiUrl,
	getContentParams,
	getManifestFingerprint,
} from "@util/api/apiCacheKeys";
import { authenticateEdge, scheduleApiCacheWrite } from "@util/api/edgeApi";
import { logger as structuredLogger } from "@util/api/logger";
import { buildRssEtag, buildRssFeed } from "@util/domain/rssFeedResponse";
import {
	getSessions,
	loadManifest,
	sortSessions,
} from "@util/domain/sessionFeedEdge";
import { NextResponse } from "next/server";
import { FEED_CACHE_HEADERS, NO_STORE_HEADERS } from "./cache";

export const runtime = "edge";
export const dynamic = "force-dynamic";

// Generated enclosure capabilities last 24 hours. Rotate the storage-backed
// feed two hours earlier, leaving enough time for the one-hour CDN response
// and stale window without publishing an expired enclosure URL.
const RSS_MEDIA_URL_WINDOW_MS = 22 * 60 * 60 * 1000;

function getPositiveInt(value, fallback, max) {
	const parsed = Number.parseInt(value || "", 10);
	const safe = Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
	return Math.min(safe, max);
}

function getMaxDateFromRss(rss) {
	const matches = [...rss.matchAll(/<pubDate>([^<]+)<\/pubDate>/g)];
	if (matches.length === 0) return new Date().toUTCString();
	const timestamps = matches
		.map((match) => new Date(match[1]).getTime())
		.filter((value) => Number.isFinite(value));
	if (timestamps.length === 0) return new Date().toUTCString();
	return new Date(Math.max(...timestamps)).toUTCString();
}

export async function GET(request) {
	try {
		const { searchParams } = new URL(request.url);
		const group = searchParams.get("group");
		const count = getPositiveInt(searchParams.get("count"), 50, 500);

		const authenticated = await authenticateEdge(searchParams);
		if (!authenticated) {
			return new NextResponse("Unauthorized", {
				status: 403,
				headers: NO_STORE_HEADERS,
			});
		}

		const baseUrl = process.env.SITE_URL || "https://systemconcepts.app";
		const canonicalSelfUrl = buildCanonicalApiUrl(
			baseUrl,
			"/api/rss",
			searchParams,
		);
		const manifest = await loadManifest();
		const fingerprint = getManifestFingerprint(manifest, { group });
		const contentParams = {
			...getContentParams("rss", searchParams),
			mediaUrlWindow: Math.floor(Date.now() / RSS_MEDIA_URL_WINDOW_MS),
		};
		const cacheKey = await buildApiCacheKey("rss", contentParams, fingerprint);
		let rss = await readApiCacheEdge("rss", cacheKey);
		let maxDate;

		if (!rss) {
			const sessions = sortSessions(await getSessions({ group })).slice(
				0,
				count,
			);
			const built = await buildRssFeed({
				sessions,
				group,
				baseUrl,
				canonicalSelfUrl,
			});
			rss = built.rss;
			maxDate = built.maxDate;
			scheduleApiCacheWrite("rss", cacheKey, rss);
		} else {
			maxDate = getMaxDateFromRss(rss);
		}

		const etag = await buildRssEtag(rss);
		const ifNoneMatch = request.headers.get("if-none-match");
		if (ifNoneMatch && ifNoneMatch === `"${etag}"`) {
			return new Response(null, {
				status: 304,
				headers: {
					ETag: `"${etag}"`,
					"Last-Modified": maxDate,
					...FEED_CACHE_HEADERS,
				},
			});
		}

		const encoded = new TextEncoder().encode(rss);
		return new Response(encoded, {
			status: 200,
			headers: {
				"Content-Type": "application/rss+xml; charset=utf-8",
				"Content-Length": encoded.byteLength.toString(),
				ETag: `"${etag}"`,
				"Last-Modified": maxDate,
				...FEED_CACHE_HEADERS,
				"Accept-Ranges": "bytes",
			},
		});
	} catch (err) {
		structuredLogger.error("RSS Error:", err);
		return new NextResponse("Error generating RSS feed", {
			status: 500,
			headers: NO_STORE_HEADERS,
		});
	}
}
