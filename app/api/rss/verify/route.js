/**
 * Internal-only auth verification endpoint for the Edge RSS route.
 * Runs on Node.js runtime so it can access the MongoDB driver.
 *
 * Security:
 *   - Protected by x-internal-key header (must equal process.env.AWS_SECRET)
 *   - Returns only { ok: boolean } — no user data leaked
 *   - Not intended to be called by clients directly
 */

import { authenticateTokenRequest } from "@util/api/api";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request) {
	const internalKey = request.headers.get("x-internal-key");
	const expectedKey = process.env.AWS_SECRET;

	if (!internalKey || !expectedKey || internalKey !== expectedKey) {
		return new NextResponse(null, { status: 403 });
	}

	try {
		const body = await request.json();
		const { id, token } = body || {};
		if (!id || !token) {
			return NextResponse.json({ ok: false });
		}

		const params = new URLSearchParams({ id: String(id), token: String(token) });
		const user = await authenticateTokenRequest(params);
		return NextResponse.json({ ok: !!user });
	} catch (err) {
		console.error("[RSS Verify] Unexpected error:", err);
		return NextResponse.json({ ok: false });
	}
}
