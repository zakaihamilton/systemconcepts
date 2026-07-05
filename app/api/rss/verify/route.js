import { logger as structuredLogger } from "@util/api/logger";

/**
 * Internal-only auth verification endpoint for the Edge RSS route.
 * Runs on Node.js runtime so it can access the MongoDB driver.
 *
 * Security:
 *   - Protected by x-internal-key header (must equal process.env.AWS_SECRET)
 *   - Returns only { ok: boolean } — no user data leaked
 *   - Not intended to be called by clients directly
 */

import { createHash } from "node:crypto";
import { authenticateTokenRequest } from "@util/api/api";
import { unstable_cache } from "next/cache";
import { NextResponse } from "next/server";
import { NO_STORE_HEADERS } from "../cache";

export const dynamic = "force-dynamic";

const AUTH_CACHE_TTL_SECONDS = 60;

async function authenticateCached(id, token) {
	const tokenDigest = createHash("sha256").update(token).digest("hex");
	const verify = unstable_cache(
		async () => {
			const params = new URLSearchParams({ id, token });
			return !!(await authenticateTokenRequest(params));
		},
		["rss-auth", id, tokenDigest],
		{ revalidate: AUTH_CACHE_TTL_SECONDS },
	);

	return verify();
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
		const body = await request.json();
		const { id, token } = body || {};
		if (!id || !token) {
			return NextResponse.json({ ok: false }, { headers: NO_STORE_HEADERS });
		}

		const ok = await authenticateCached(String(id), String(token));
		return NextResponse.json({ ok }, { headers: NO_STORE_HEADERS });
	} catch (err) {
		structuredLogger.error("[RSS Verify] Unexpected error:", err);
		return NextResponse.json({ ok: false }, { headers: NO_STORE_HEADERS });
	}
}
