import { logger as structuredLogger } from "@util/api/logger";
import { internalRateLimitRequestSchema, parseBody } from "@util/api/schemas";
import { checkRateLimit } from "@util/auth/rateLimit";
import { NextResponse } from "next/server";
import { NO_STORE_HEADERS } from "../../rss/cache";

export const dynamic = "force-dynamic";

export async function POST(request: any) {
	const internalKey = request.headers.get("x-internal-key");
	const expectedKey = process.env.AWS_SECRET;

	if (!internalKey || !expectedKey || internalKey !== expectedKey) {
		return new NextResponse(null, {
			status: 403,
			headers: NO_STORE_HEADERS,
		});
	}

	try {
		const body = parseBody(
			internalRateLimitRequestSchema,
			await request.json(),
		);
		if (!body) {
			return NextResponse.json({ ok: false }, { headers: NO_STORE_HEADERS });
		}
		const { ip, limit = 60, windowMs = 60 * 1000 } = body;

		await checkRateLimit({ ip }, { limit, windowMs, key: String(ip) });
		return NextResponse.json({ ok: true }, { headers: NO_STORE_HEADERS });
	} catch (err: any) {
		if (err === "RATE_LIMIT_EXCEEDED") {
			return NextResponse.json({ ok: false }, { headers: NO_STORE_HEADERS });
		}
		structuredLogger.error("[Rate Limit Internal] Unexpected error:", err);
		return NextResponse.json(
			{ ok: false },
			{ status: 503, headers: NO_STORE_HEADERS },
		);
	}
}
