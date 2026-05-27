import { authenticateTokenRequest, getPositiveInt } from "@util/api/api";
import {
	getSProxyUrl,
	getSessions,
	getTranscriptProxyUrl,
	sortSessions,
} from "@util/domain/sessionFeed";
import { formatDuration } from "@util/data/string";
import crypto from "crypto";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

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

export async function GET(request) {
	try {
		const { searchParams } = new URL(request.url);
		const group = searchParams.get("group");
		const count = getPositiveInt(searchParams.get("count"), 250, 500);
		const user = await authenticateTokenRequest(searchParams);
		if (!user) {
			return new NextResponse("Unauthorized", { status: 403 });
		}

		const sessions = sortSessions(await getSessions({ group })).slice(0, count);

		const baseUrl =
			process.env.NEXT_PUBLIC_SITE_URL || "https://systemconcepts.app";

		const rssItems = await Promise.all(
			sessions.map(async (session) => {
				// Do not URL-encode the ?, &, and = characters in the local app link
				const sessionQuery = `session?group=${encodeURIComponent(session.group)}&year=${encodeURIComponent(session.year)}&date=${encodeURIComponent(session.date)}&name=${encodeURIComponent(session.name)}`;
				const link = `${baseUrl}/#sessions/${sessionQuery}`;

				// RFC 2822 formatting requires strictly +0000
				const date = new Date(session.date)
					.toUTCString()
					.replace("GMT", "+0000");
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

				// Transcript support
				let transcriptTag = "";
				let transcriptPath = session.subtitles?.path || session.transcriptPath;
				let transcriptType = transcriptPath?.endsWith(".vtt")
					? "text/vtt"
					: "text/plain";
				const transcriptUrl = await getTranscriptProxyUrl(session, baseUrl);
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
			}),
		);

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

		const etag = crypto.createHash("md5").update(rss).digest("hex");
		const buffer = Buffer.from(rss, "utf-8");

		return new Response(buffer, {
			status: 200,
			headers: {
				"Content-Type": "application/rss+xml; charset=utf-8",
				"Content-Length": buffer.length.toString(),
				ETag: `"${etag}"`,
				"Last-Modified": maxDate,
				"Cache-Control": "no-cache, no-store, must-revalidate",
				Pragma: "no-cache",
				Expires: "0",
				"Accept-Ranges": "bytes",
			},
		});
	} catch (err) {
		console.error("RSS Error:", err);
		return new NextResponse("Error generating RSS feed", { status: 500 });
	}
}
