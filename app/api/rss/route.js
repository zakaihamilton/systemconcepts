import { NextResponse } from "next/server";
import { downloadData, getS3 } from "@util/aws";
import { formatDuration } from "@util/string";
import { findRecord } from "@util/mongo";
import { getWasabi } from "@util/wasabi";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import pako from "pako";
import crypto from "crypto";

export const dynamic = "force-dynamic";

const BUNDLE_PATH = "sync/bundle.json.gz";

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

        const fileData = await downloadData({ path: BUNDLE_PATH, binary: true });

        let jsonStr;
        try {
            const decompressed = pako.inflate(fileData, { to: "string" });
            jsonStr = decompressed;
        } catch (_e) {
            jsonStr = Buffer.from(fileData).toString('utf-8');
        }

        const bundle = JSON.parse(jsonStr);

        let sessions = bundle.sessions || [];

        if (group) {
            sessions = sessions.filter(s => s.group === group);
        }

        sessions.sort((a, b) => new Date(b.date) - new Date(a.date));
        sessions = sessions.slice(0, count);

        const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://systemconcepts.app';

        const rssItems = await Promise.all(sessions.map(async (session) => {
            const link = `${baseUrl}/#sessions/${encodeURIComponent(`session?group=${session.group}&year=${session.year}&date=${session.date}&name=${session.name}`)}`;
            const date = new Date(session.date).toUTCString();
            const durationText = session.duration > 1 ? formatDuration(session.duration * 1000, true) : "";
            const categories = (session.tags || []).map(tag => `<category>${escapeXml(tag)}</category>`).join('');
            
            let description = `Group: ${escapeXml(session.group)}\nDate: ${escapeXml(session.date)}`;
            if (durationText) {
                description += `\nDuration: ${escapeXml(durationText)}`;
            }
            if (session.summaryText) {
                description += `\n\nSynopsis:\n${escapeXml(session.summaryText)}`;
            }

            const media = session.audio || session.video;
            let enclosure = "";
            if (media && media.path) {
                const s3Key = media.path.startsWith("/") ? media.path.substring(1) : media.path;
                let client, bucket;
                if (s3Key.startsWith("wasabi/")) {
                    const wasabi = await getWasabi();
                    client = wasabi.client;
                    bucket = wasabi.bucket;
                } else {
                    client = await getS3({});
                    bucket = process.env.AWS_BUCKET;
                }
                const key = s3Key.replace(/^wasabi\//, "");
                const command = new GetObjectCommand({ Bucket: bucket, Key: key });
                const signedUrl = await getSignedUrl(client, command, { expiresIn: 86400 });
                const type = s3Key.endsWith(".mp4") ? "video/mp4" : (s3Key.endsWith(".m4a") ? "audio/x-m4a" : "audio/mpeg");
                enclosure = `<enclosure url="${escapeXml(signedUrl)}" length="${media.size || 0}" type="${type}" />`;
            }

            return `
    <item>
      <title>[${escapeXml(session.group?.toUpperCase()[0] + session.group?.slice(1))}] ${escapeXml(session.date + " " + session.name)}</title>
      <link>${escapeXml(link)}</link>
      <description>${escapeXml(description)}</description>
      <pubDate>${date}</pubDate>
      <guid>${escapeXml(link)}</guid>
      ${categories}
      ${enclosure}
      <itunes:duration>${escapeXml(durationText)}</itunes:duration>
      <itunes:summary>${escapeXml(session.summaryText)}</itunes:summary>
      <itunes:explicit>no</itunes:explicit>
    </item>`;
        }));

        const rss = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">
<channel>
  <title>System Concepts - ${escapeXml(group ? group + ' ' : '')}Sessions</title>
  <atom:link href="${escapeXml(request.url)}" rel="self" type="application/rss+xml" />
  <description>Latest sessions from System Concepts</description>
  <link>${escapeXml(baseUrl)}</link>
  <language>en-us</language>
  <itunes:explicit>no</itunes:explicit>
  ${rssItems.join('')}
</channel>
</rss>`;

        return new NextResponse(rss, {
            status: 200,
            headers: {
                'Content-Type': 'application/rss+xml',
            },
        });
    } catch (err) {
        console.error("RSS Error:", err);
        return new NextResponse("Error generating RSS feed", { status: 500 });
    }
}
