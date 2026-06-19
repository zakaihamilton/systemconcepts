/**
 * RSS feed endpoint — runs on Vercel Edge Runtime.
 * - No Node.js APIs (no `crypto`, no `Buffer`)
 * - Auth delegated to /api/rss/verify (Node.js runtime, MongoDB access)
 * - S3 fetches via sessionFeedEdge (fetch + Web Crypto presigner)
 * - ETags via crypto.subtle SHA-256 (MD5 not available in Web Crypto)
 */

import { formatDuration } from "@util/data/string";
import {
	getSessions,
	getSProxyUrl,
	getTranscriptProxyUrlFast,
	sortSessions,
} from "@util/domain/sessionFeedEdge";
import { NextResponse } from "next/server";
import { FEED_CACHE_HEADERS, NO_STORE_HEADERS } from "./cache";

export const runtime = "edge";
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getPositiveInt(value, fallback, max) {
	const parsed = Number.parseInt(value || "", 10);
	const safe = Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
	return Math.min(safe, max);
}

function escapeXml(unsafe) {
	if (!unsafe) return "";
	return unsafe.replace(/[<>&'"]/g, (c) => {
		switch (c) {
			case "<":
				return "&lt;";
			case ">":
				return "&gt;";
			case "&":
				return "&amp;";
			case "'":
				return "&apos;";
			case '"':
				return "&quot;";
			default:
				return c;
		}
	});
}

// ---------------------------------------------------------------------------
// Edge auth — delegates to /api/rss/verify (Node.js runtime with MongoDB)
// ---------------------------------------------------------------------------

/** Short-lived in-memory cache to avoid repeated verify round-trips */
const authCache = new Map();
const AUTH_CACHE_TTL_MS = 60 * 1000;

async function authenticateEdge(searchParams) {
	const id = searchParams.get("id");
	const token = searchParams.get("token");
	if (!id || !token) return false;

	// Check in-memory cache first
	const cacheKey = `${id}:${token}`;
	const now = Date.now();
	const cached = authCache.get(cacheKey);
	if (cached && cached.expiresAt > now) return cached.ok;

	const siteUrl = process.env.SITE_URL;
	if (!siteUrl) {
		console.error("[RSS Edge] SITE_URL env var not set — cannot verify token");
		return false;
	}

	try {
		const res = await fetch(`${siteUrl}/api/rss/verify`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				// Shared secret: only the same deployment can call this endpoint
				"x-internal-key": process.env.AWS_SECRET || "",
			},
			body: JSON.stringify({ id, token }),
		});
		if (!res.ok) {
			console.warn("[RSS Edge] Verify endpoint returned", res.status);
			return false;
		}
		const { ok } = await res.json();
		// Cache result for 60s to avoid repeated Mongo lookups on podcast polls
		authCache.set(cacheKey, {
			ok: ok === true,
			expiresAt: now + AUTH_CACHE_TTL_MS,
		});
		return ok === true;
	} catch (err) {
		console.error("[RSS Edge] Auth fetch failed:", err);
		return false;
	}
}

// ---------------------------------------------------------------------------
// GET handler
// ---------------------------------------------------------------------------

export async function GET(request) {
	try {
		const { searchParams } = new URL(request.url);
		const group = searchParams.get("group");
		const count = getPositiveInt(searchParams.get("count"), 250, 500);

		const authenticated = await authenticateEdge(searchParams);
		if (!authenticated) {
			return new NextResponse("Unauthorized", {
				status: 403,
				headers: NO_STORE_HEADERS,
			});
		}

		const sessions = sortSessions(await getSessions({ group })).slice(0, count);

		const baseUrl = process.env.SITE_URL || "https://systemconcepts.app";

		const rssItems = sessions.map((session) => {
			// Do not URL-encode the ?, &, and = characters in the local app link
			const sessionQuery = `session?group=${encodeURIComponent(session.group)}&year=${encodeURIComponent(session.year)}&date=${encodeURIComponent(session.date)}&name=${encodeURIComponent(session.name)}`;
			const link = `${baseUrl}/#sessions/${sessionQuery}`;

			// RFC 2822 formatting requires strictly +0000
			const date = new Date(session.date).toUTCString().replace("GMT", "+0000");
			// Apple recommends integer seconds
			const durationSeconds = session.duration
				? Math.round(session.duration)
				: 0;
			const categories = (session.tags || [])
				.map((tag) => `<category>${escapeXml(tag)}</category>`)
				.join("");

			let description = `Group: ${escapeXml(session.group)}\nDate: ${escapeXml(session.date)}`;
			if (durationSeconds > 0) {
				description += `\nDuration: ${escapeXml(formatDuration(durationSeconds * 1000, true))}`;
			}
			if (session.summaryText) {
				description += `\n\nSynopsis:\n${escapeXml(session.summaryText)}`;
			}

			const media = session.audio || session.video;
			let enclosure = "";
			if (media && media.path) {
				const proxyUrl = getSProxyUrl(media.path, baseUrl);
				const type = media.path.endsWith(".mp4")
					? "video/mp4"
					: media.path.endsWith(".m4a")
						? "audio/x-m4a"
						: "audio/mpeg";
				enclosure = `<enclosure url="${escapeXml(proxyUrl)}" length="${media.size || 0}" type="${type}" />`;
			}

			const thumbnail = getSProxyUrl(session.image?.path, baseUrl);
			const itemImage = `<itunes:image href="${escapeXml(thumbnail || baseUrl + "/images/rss-cover.jpg")}" />`;

			// Transcript support — fast path, no S3 HEAD calls
			let transcriptTag = "";
			const transcriptPath = session.subtitles?.path || session.transcriptPath;
			const transcriptType = transcriptPath?.endsWith(".vtt")
				? "text/vtt"
				: "text/plain";
			const transcriptUrl = getTranscriptProxyUrlFast(session, baseUrl);
			if (transcriptUrl) {
				transcriptTag = `<podcast:transcript url="${escapeXml(transcriptUrl)}" type="${transcriptType}" />`;
			}

			const author = "info@systemconcepts.app (System Concepts)";
			const itunesAuthor = "System Concepts";

			return `
    <item>
      <title>[${escapeXml(session.group?.toUpperCase()[0] + session.group?.slice(1))}] ${escapeXml(session.date + " " + session.name)}</title>
      <link>${escapeXml(link)}</link>
      <description>${escapeXml(description)}</description>
      <content:encoded><![CDATA[${description.replace(/\n/g, "<br/>")}]]></content:encoded>
      <pubDate>${date}</pubDate>
      <guid>${escapeXml(link)}</guid>
      <author>${escapeXml(author)}</author>
      <itunes:author>${escapeXml(itunesAuthor)}</itunes:author>
      ${itemImage}
      ${categories}
      ${enclosure}
      ${transcriptTag}
      <itunes:duration>${durationSeconds}</itunes:duration>
      <itunes:summary>${escapeXml(session.summaryText)}</itunes:summary>
      <itunes:explicit>true</itunes:explicit>
    </item>`;
		});

		const maxDate =
			sessions.length > 0
				? new Date(
						Math.max(...sessions.map((s) => new Date(s.date))),
					).toUTCString()
				: new Date().toUTCString();
		const selfUrl = request.url;

		const rss = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:podcast="https://podcastindex.org/namespace/1.0">
<channel>
  <title>System Concepts - ${escapeXml(group ? group + " " : "")}Sessions</title>
  <itunes:image href="${baseUrl}/images/rss-cover.jpg" />
  <image>
    <url>${baseUrl}/images/rss-cover.jpg</url>
    <title>System Concepts</title>
    <link>${baseUrl}</link>
  </image>
  <atom:link href="${escapeXml(selfUrl)}" rel="self" type="application/rss+xml" />
  <description>Latest sessions from System Concepts</description>
  <link>${escapeXml(baseUrl)}</link>
  <language>en</language>
  <copyright>Copyright © 2026 System Concepts</copyright>
  <itunes:author>System Concepts</itunes:author>
  <itunes:owner>
    <itunes:name>System Concepts</itunes:name>
    <itunes:email>info@systemconcepts.app</itunes:email>
  </itunes:owner>
  <itunes:type>episodic</itunes:type>
  <itunes:explicit>true</itunes:explicit>
  <itunes:category text="Education">
    <itunes:category text="Self-Improvement"/>
  </itunes:category>
  <itunes:category text="Society &amp; Culture">
    <itunes:category text="Philosophy"/>
  </itunes:category>
  <itunes:category text="Religion &amp; Spirituality">
    <itunes:category text="Spirituality"/>
  </itunes:category>
  ${rssItems.join("")}
</channel>
</rss>`;

		// ETag via Web Crypto SHA-256 (MD5 not available in Edge runtime)
		const hashBuffer = await crypto.subtle.digest(
			"SHA-256",
			new TextEncoder().encode(rss),
		);
		const etag = Array.from(new Uint8Array(hashBuffer))
			.map((b) => b.toString(16).padStart(2, "0"))
			.join("");

		// Return 304 Not Modified if the client already has this version
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

		// Use TextEncoder for byte-accurate Content-Length (handles non-ASCII like ©)
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
		console.error("RSS Error:", err);
		return new NextResponse("Error generating RSS feed", {
			status: 500,
			headers: NO_STORE_HEADERS,
		});
	}
}
