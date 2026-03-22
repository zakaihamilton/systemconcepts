import { NextResponse } from "next/server";
import { downloadData } from "@util/aws";
import pako from "pako";

export const dynamic = "force-dynamic";

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

        let path = "sync/bundle.json";
        const fileData = await downloadData({ path, binary: true });

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

        const rssItems = sessions.map(session => {
            const link = `https://systemconcepts.org/session?group=${encodeURIComponent(session.group)}&year=${encodeURIComponent(session.year)}&date=${encodeURIComponent(session.date)}&name=${encodeURIComponent(session.name)}`;
            const date = new Date(session.date).toUTCString();
            return `
    <item>
      <title>${escapeXml(session.name)}</title>
      <link>${escapeXml(link)}</link>
      <pubDate>${date}</pubDate>
      <guid>${escapeXml(link)}</guid>
    </item>`;
        }).join('');

        const rss = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0">
<channel>
  <title>System Concepts - ${escapeXml(group ? group + ' ' : '')}Sessions</title>
  <description>Latest sessions from System Concepts</description>
  <link>https://systemconcepts.org</link>
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
