import { NextResponse } from "next/server";
import { downloadData } from "@util/aws";
import { formatDuration } from "@util/string";
import pako from "pako";

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

        const rssItems = sessions.map(session => {
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

            return `
    <item>
      <title>[${escapeXml(session.group?.toUpperCase()[0] + session.group?.slice(1))}] ${escapeXml(session.date + " " + session.name)}</title>
      <link>${escapeXml(link)}</link>
      <description>${escapeXml(description)}</description>
      <pubDate>${date}</pubDate>
      <guid>${escapeXml(link)}</guid>
      ${categories}
    </item>`;
        }).join('');

        const rss = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0">
<channel>
  <title>System Concepts - ${escapeXml(group ? group + ' ' : '')}Sessions</title>
  <description>Latest sessions from System Concepts</description>
  <link>${escapeXml(baseUrl)}</link>
  ${rssItems}
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
