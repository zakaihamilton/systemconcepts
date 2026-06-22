import { getSafeError } from "@util/api/safeError";
import { roleAuth } from "@util/auth/roles";
import { getAuthErrorStatus, getSessionUser } from "@util/auth/session";
import { getDownloadUrl, handleRequest } from "@util/storage/wasabi";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const NO_CACHE_HEADERS = {
	"Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
	Pragma: "no-cache",
	Expires: "0",
};

export async function GET(request) {
	try {
		const url = new URL(request.url);
		let path =
			request.headers.get("path") || url.searchParams.get("path") || "";
		if (path) path = decodeURIComponent(path);

		const user = await getSessionUser(request);
		if (!user || !roleAuth(user.role, "student")) throw "ACCESS_DENIED";

		const isDir =
			url.searchParams.get("type") === "dir" ||
			request.headers.get("type") === "dir";
		const isExists =
			url.searchParams.get("exists") || request.headers.get("exists");

		if (!isDir && !isExists) {
			const downloadUrl = await getDownloadUrl({ path });
			return NextResponse.redirect(downloadUrl, {
				status: 307,
				headers: NO_CACHE_HEADERS,
			});
		}

		const req = {
			method: "GET",
			headers: Object.fromEntries(request.headers.entries()),
			query: Object.fromEntries(url.searchParams.entries()),
		};

		const result = await handleRequest({ req, path });
		const headers = new Headers(NO_CACHE_HEADERS);

		if (Buffer.isBuffer(result)) {
			return new NextResponse(result, { status: 200, headers });
		} else if (typeof result === "object") {
			return NextResponse.json(result, { status: 200, headers });
		} else {
			return new NextResponse(result, { status: 200, headers });
		}
	} catch (err) {
		return NextResponse.json(
			{ err: getSafeError(err) },
			{ status: getAuthErrorStatus(err), headers: NO_CACHE_HEADERS },
		);
	}
}
