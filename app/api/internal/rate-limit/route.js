import { createHash } from "node:crypto";
import { logger as structuredLogger } from "@util/api/logger";
import { internalRateLimitRequestSchema, parseBody } from "@util/api/schemas";
import { checkRateLimit } from "@util/auth/rateLimit";
import { unstable_cache } from "next/cache";
import { NextResponse } from "next/server";
import { NO_STORE_HEADERS } from "../../rss/cache";

export const dynamic = "force-dynamic";

const RATE_LIMIT_CACHE_TTL_SECONDS = 5;

async function checkRateLimitCached({ ip, limit, windowMs }) {
	const ipDigest = createHash("sha256").update(ip).digest("hex");
	const check = unstable_cache(
		async () => {
			try {
				await checkRateLimit({ ip }, { limit, windowMs, key: ip });
				return true;
			} catch (err) {
				if (err === "RATE_LIMIT_EXCEEDED") return false;
				throw err;
			}
		},
		["rate-limit", ipDigest, String(limit), String(windowMs)],
		{ revalidate: RATE_LIMIT_CACHE_TTL_SECONDS },
	);

	return check();
}

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
		const body = parseBody(
			internalRateLimitRequestSchema,
			await request.json(),
		);
		if (!body) {
			return NextResponse.json({ ok: false }, { headers: NO_STORE_HEADERS });
		}
		const { ip, limit = 60, windowMs = 60 * 1000 } = body;

		const ok = await checkRateLimitCached({
			ip: String(ip),
			limit,
			windowMs,
		});
		return NextResponse.json({ ok }, { headers: NO_STORE_HEADERS });
	} catch (err) {
		structuredLogger.error("[Rate Limit Internal] Unexpected error:", err);
		return NextResponse.json({ ok: false }, { headers: NO_STORE_HEADERS });
	}
}
