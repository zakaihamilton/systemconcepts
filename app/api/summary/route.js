import { NextResponse } from "next/server";
import { downloadData, validatePathAccess } from "@util/aws";
import { login } from "@util/login";
import parseCookie from "@util/cookie";
import { roleAuth } from "@util/roles";
import { error } from "@util/logger";

export const dynamic = "force-dynamic";

const component = "summary";

export async function GET(request) {
    try {
        const url = new URL(request.url);
        const path = url.searchParams.get("path");
        const cookieHeader = request.headers.get("cookie") || "";

        if (!cookieHeader) throw "ACCESS_DENIED";
        const cookies = parseCookie(cookieHeader);
        const { id, hash } = cookies || {};
        if (!id || !hash) throw "ACCESS_DENIED";

        const user = await login({ id, hash, api: "summary" });
        if (!user) throw "ACCESS_DENIED";
        if (!roleAuth(user.role, "student")) throw "ACCESS_DENIED";

        const decodedPath = decodeURIComponent(path);
        validatePathAccess(decodedPath);
        const data = await downloadData({ path: decodedPath });

        return new NextResponse(data, {
            status: 200,
            headers: { "Content-Type": "text/markdown" }
        });
    } catch (err) {
        error({ component, error: "error", err });
        return new NextResponse(null, { status: 404 });
    }
}
