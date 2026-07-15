import { writeApiCache } from "@util/api/apiCache";
import { logger as structuredLogger } from "@util/api/logger";
import { internalCacheRequestSchema, parseBody } from "@util/api/schemas";
import { NextResponse } from "next/server";
import { NO_STORE_HEADERS } from "../../rss/cache";

export const dynamic = "force-dynamic";

export async function POST(request) {
	const internalKey = request.headers.get("x-internal-key");
	const expectedKey = process.env.AWS_SECRET;

	if (!internalKey || !expectedKey || internalKey !== expectedKey) {
		return new NextResponse(null, {
			status: 403,
			headers: NO_STORE_HEADERS,
		});
	}

	try {
		const body = parseBody(internalCacheRequestSchema, await request.json());
		if (!body) {
			return NextResponse.json({ ok: false }, { headers: NO_STORE_HEADERS });
		}
		const { type, key, body: cacheBody } = body;

		await writeApiCache(type, key, cacheBody);
		return NextResponse.json({ ok: true }, { headers: NO_STORE_HEADERS });
	} catch (err) {
		structuredLogger.error("[API Cache Write] Unexpected error:", err);
		return NextResponse.json({ ok: false }, { headers: NO_STORE_HEADERS });
	}
}
