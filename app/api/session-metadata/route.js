import parseCookie from "@util/api/cookie";
import { login } from "@util/auth/login";
import { roleAuth } from "@util/auth/roles";
import { getSafeError } from "@util/api/safeError";
import { aggregateSessionMetadata } from "@util/domain/updateSessions/sessionMetadataServer";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const SESSION_METADATA_HEADERS = {
	"Cache-Control": "no-store",
};

export async function GET(request) {
	try {
		const cookieHeader = request.headers.get("cookie") || "";
		const cookies = parseCookie(cookieHeader);
		const { id, hash } = cookies || {};
		if (!id || !hash) throw "ACCESS_DENIED";

		const url = new URL(request.url);
		const group = url.searchParams.get("group");
		const year = url.searchParams.get("year");
		const path = `sessions/${group || ""}/${year || ""}`;

		const user = await login({ id, hash, api: "aws", path });
		if (!user || !roleAuth(user.role, "student")) throw "ACCESS_DENIED";

		const result = await aggregateSessionMetadata({ group, year });
		return NextResponse.json(result, {
			status: 200,
			headers: new Headers(SESSION_METADATA_HEADERS),
		});
	} catch (err) {
		return NextResponse.json({ err: getSafeError(err) }, { status: 403 });
	}
}
