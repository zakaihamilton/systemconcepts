import { getSafeError } from "@util/api/safeError";
import { roleAuth } from "@util/auth/roles";
import { getAuthErrorStatus, getSessionUser } from "@util/auth/session";
import { aggregateSessionMetadata } from "@util/domain/updateSessions/sessionMetadataServer";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const SESSION_METADATA_HEADERS = {
	"Cache-Control": "no-store",
};

export async function GET(request) {
	try {
		const url = new URL(request.url);
		const group = url.searchParams.get("group");
		const year = url.searchParams.get("year");
		const user = await getSessionUser(request);
		if (!user || !roleAuth(user.role, "student")) throw "ACCESS_DENIED";

		const result = await aggregateSessionMetadata({ group, year });
		return NextResponse.json(result, {
			status: 200,
			headers: new Headers(SESSION_METADATA_HEADERS),
		});
	} catch (err) {
		return NextResponse.json(
			{ err: getSafeError(err) },
			{ status: getAuthErrorStatus(err) },
		);
	}
}
