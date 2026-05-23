import parseCookie from "@util/cookie";
import { login } from "@util/login";
import { roleAuth } from "@util/roles";
import { getSafeError } from "@util/safeError";
import { aggregateSessionMetadata } from "@util/updateSessions/sessionMetadataServer";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const NO_CACHE_HEADERS = {
	"Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
	Pragma: "no-cache",
	Expires: "0",
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
			headers: new Headers(NO_CACHE_HEADERS),
		});
	} catch (err) {
		return NextResponse.json({ err: getSafeError(err) }, { status: 403 });
	}
}
