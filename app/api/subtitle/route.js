import { downloadData, validatePathAccess } from "@util/aws";
import parseCookie from "@util/cookie";
import { error } from "@util/logger";
import { login } from "@util/login";
import { roleAuth } from "@util/roles";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const component = "subtitle";

export async function GET(request) {
	try {
		const url = new URL(request.url);
		const path = url.searchParams.get("path");
		const cookieHeader = request.headers.get("cookie") || "";

		if (!cookieHeader) throw "ACCESS_DENIED";
		const cookies = parseCookie(cookieHeader);
		const { id, hash } = cookies || {};
		const user = await login({ id, hash, api: "subtitle" });
		if (!user || !roleAuth(user.role, "student")) throw "ACCESS_DENIED";

		let decodedPath = decodeURIComponent(path);
		validatePathAccess(decodedPath);

		const data = await downloadData({ path: decodedPath });

		return new NextResponse(data, {
			status: 200,
			headers: { "Content-Type": "text/vtt" },
		});
	} catch (err) {
		error({ component, error: "Subtitle fetch error", err });
		return new NextResponse(null, { status: 404 });
	}
}
