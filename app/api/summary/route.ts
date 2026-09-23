import { error } from "@util/api/logger";
import { roleAuth } from "@util/auth/roles";
import { getAuthErrorStatus, getSessionUser } from "@util/auth/session";
import { downloadData, normalizeSessionContentPath } from "@util/storage/aws";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const component = "summary";
const STABLE_CONTENT_HEADERS = {
	"Content-Type": "text/markdown",
	"Cache-Control": "private, max-age=86400, stale-while-revalidate=604800",
};

export async function GET(request: any) {
	try {
		const url = new URL(request.url);
		const path = url.searchParams.get("path");
		const user = await getSessionUser(request);
		if (!user) throw "ACCESS_DENIED";
		if (!roleAuth(user.role, "student")) throw "ACCESS_DENIED";

		const sessionPath = normalizeSessionContentPath(path);
		const data = await downloadData({ path: sessionPath });

		return new NextResponse(data, {
			status: 200,
			headers: STABLE_CONTENT_HEADERS,
		});
	} catch (err: any) {
		error({ component, error: "error", err });
		return new NextResponse(null, { status: getAuthErrorStatus(err, 404) });
	}
}
