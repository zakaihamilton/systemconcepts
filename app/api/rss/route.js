import { NextResponse } from "next/server";
import { downloadData } from "@util/aws";
import { formatDuration } from "@util/string";
import { findRecord } from "@util/mongo";
import pLimit from "@util/p-limit";
import pako from "pako";
import crypto from "crypto";

export const dynamic = "force-dynamic";

const MANIFEST_PATH = "sync/files.json.gz";

function escapeXml(unsafe) {
    if (!unsafe) return "";
    return unsafe.replace(/[<>&'"]/g, (c) => {
        switch (c) {
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '&': return '&amp;';
            case '\'': return '&apos;';
            case '"': return '&quot;';
            default: return c;
        }
    });
}

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const group = searchParams.get('group');
        const count = parseInt(searchParams.get('count') || '50', 10);
        const id = searchParams.get('id');
        const token = searchParams.get('token');

        if (!id || !token) {
            return new NextResponse("Unauthorized", { status: 403 });
        }

        const user = await findRecord({ collectionName: "users", query: { id: id.toLowerCase() } });
        if (!user || user.role === 'visitor') {
            return new NextResponse("Unauthorized", { status: 403 });
        }

        const expectedToken = crypto.createHash('sha256').update(user.id + user.hash + (process.env.RSS_SECRET || process.env.AWS_SECRET)).digest('hex');
        if (token !== expectedToken) {
            return new NextResponse("Unauthorized", { status: 403 });
        }

        const manifestData = await downloadData({ path: MANIFEST_PATH, binary: true });

        let manifestStr;
        try {
            const decompressed = pako.inflate(manifestData);
            manifestStr = new TextDecoder("utf-8").decode(decompressed);
        } catch (_e) {
            manifestStr = Buffer.from(manifestData).toString('utf-8');
        }

        const manifest = JSON.parse(manifestStr);
        let files = manifest.filter(f => f.path && f.path.endsWith(".json") && f.path !== "/files.json");

        if (group) {
            files = files.filter(f => f.path === "/bundle.json" || f.path === `/${group}.json` || f.path.startsWith(`/${group}/`));
        }

        const limit = pLimit(10);
        const sessionPromises = files.map(file => limit(async () => {
            try {
                const s3Path = `sync${file.path.startsWith("/") ? "" : "/"}${file.path}.gz`;
                const fileData = await downloadData({ path: s3Path, binary: true });
                let jsonStr;
                try {
                    const decompressed = pako.inflate(fileData);
                    jsonStr = new TextDecoder("utf-8").decode(decompressed);
                } catch (_e) {
                    jsonStr = Buffer.from(fileData).toString('utf-8');
                }
                const data = JSON.parse(jsonStr);
                return data.sessions || [];
            } catch (err) {
                console.error(`Error loading sessions from ${file.path}:`, err);
                return [];
            }
        }));

        const sessionsArrays = await Promise.all(sessionPromises);
        const allSessions = sessionsArrays.flat();

        const sessionMap = new Map();
        for (const session of allSessions) {
            const key = `${session.group}_${session.id}`;
            if (!sessionMap.has(key)) {
                sessionMap.set(key, session);
            }
        }

        let sessions = Array.from(sessionMap.values());

        if (group) {
            sessions = sessions.filter(s => s.group === group);
        }

        sessions.sort((a, b) => new Date(b.date) - new Date(a.date));
        sessions = sessions.slice(0, count);

        const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://systemconcepts.app';

        // Custom proxy encoder that builds clean URLs, shifting complex presigned logic to /api/rss/s
        const getSProxyUrl = (path) => {
            if (!path) return null;
            let cleanPath = path.startsWith("/") ? path.substring(1) : path;
            const b64 = Buffer.from(cleanPath).toString('base64url');
            const ext = path.split('.').pop() || "bin";
            // Use query parameters for stability, adding the extension at the end for validators
            return `${baseUrl}/api/rss/s?p=${b64}&e=.${ext}`;
        };

        const rssItems = await Promise.all(sessions.map(async (session) => {
            // Do not URL-encode the ?, &, and = characters in the local app link
            const sessionQuery = `session?group=${encodeURIComponent(session.group)}&year=${encodeURIComponent(session.year)}&date=${encodeURIComponent(session.date)}&name=${encodeURIComponent(session.name)}`;
            const link = `${baseUrl}/#sessions/${sessionQuery}`;
            
            // RFC 2822 formatting requires strictly +0000
            const date = new Date(session.date).toUTCString().replace('GMT', '+0000');
            // Apple recommends integer seconds
            const durationSeconds = session.duration ? Math.round(session.duration) : 0;
            const categories = (session.tags || []).map(tag => `<category>${escapeXml(tag)}</category>`).join('');

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
                const proxyUrl = getSProxyUrl(media.path);
                const type = media.path.endsWith(".mp4") ? "video/mp4" : (media.path.endsWith(".m4a") ? "audio/x-m4a" : "audio/mpeg");
                enclosure = `<enclosure url="${escapeXml(proxyUrl)}" length="${media.size || 0}" type="${type}" />`;
            }

            const thumbnail = getSProxyUrl(session.image?.path);
            const itemImage = `<itunes:image href="${escapeXml(thumbnail || (baseUrl + "/images/rss-cover.jpg"))}" />`;

            // Transcript support
            let transcriptTag = "";
            let transcriptPath = session.subtitles?.path || session.transcriptPath;
            let transcriptType = transcriptPath?.endsWith(".vtt") ? "text/vtt" : "text/plain";

            if (!transcriptPath && session.transcription) {
                transcriptPath = `wasabi/${session.group}/${session.year}/${session.date} ${session.name}.txt`;
                transcriptType = "text/plain";
            }

            const transcriptUrl = getSProxyUrl(transcriptPath);
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
      <content:encoded><![CDATA[${description.replace(/\n/g, '<br/>')}]]></content:encoded>
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
        }));

        const maxDate = sessions.length > 0 ? new Date(Math.max(...sessions.map(s => new Date(s.date)))).toUTCString() : new Date().toUTCString();
        const selfUrl = request.url;

        const rss = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:podcast="https://podcastindex.org/namespace/1.0">
<channel>
  <title>System Concepts - ${escapeXml(group ? group + ' ' : '')}Sessions</title>
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
  ${rssItems.join('')}
</channel>
</rss>`;

        const etag = crypto.createHash('md5').update(rss).digest('hex');
        const buffer = Buffer.from(rss, 'utf-8');

        return new Response(buffer, {
            status: 200,
            headers: {
                'Content-Type': 'application/rss+xml; charset=utf-8',
                'Content-Length': buffer.length.toString(),
                'ETag': `"${etag}"`,
                'Last-Modified': maxDate,
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0',
                'Accept-Ranges': 'bytes'
            },
        });
    } catch (err) {
        console.error("RSS Error:", err);
        return new NextResponse("Error generating RSS feed", { status: 500 });
    }
}
