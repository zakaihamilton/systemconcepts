import { NextResponse } from "next/server";
import { handleRequest } from "@util/wasabi";
import { login } from "@util/login";
import parseCookie from "@util/cookie";
import { roleAuth } from "@util/roles";
import { getSafeError } from "@util/safeError";

export const dynamic = "force-dynamic";

export async function GET(request) {
    try {
        const cookieHeader = request.headers.get("cookie") || "";
        const cookies = parseCookie(cookieHeader);
        const { id, hash } = cookies || {};
        if (!id || !hash) throw "ACCESS_DENIED";

        const url = new URL(request.url);
        let path = request.headers.get("path") || url.searchParams.get("path") || "";
        if (path) path = decodeURIComponent(path);

        const user = await login({ id, hash, api: "wasabi", path });
        if (!user || !roleAuth(user.role, "student")) throw "ACCESS_DENIED";

        const req = {
            method: "GET",
            headers: Object.fromEntries(request.headers.entries()),
            query: Object.fromEntries(url.searchParams.entries()),
        };

        const result = await handleRequest({ req, path });

        const isDir = url.searchParams.get("type") === "dir" || request.headers.get("type") === "dir";
        const isExists = url.searchParams.get("exists") || request.headers.get("exists");

        const cacheHeader = (path.startsWith("sessions/") && !isDir && !isExists)
            ? { "Cache-Control": "public, max-age=31536000, immutable" }
            : { "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate", "Pragma": "no-cache", "Expires": "0" };

        const headers = new Headers(cacheHeader);

        if (Buffer.isBuffer(result)) {
            return new NextResponse(result, { status: 200, headers });
        } else if (typeof result === "object") {
            return NextResponse.json(result, { status: 200, headers });
        } else {
            return new NextResponse(result, { status: 200, headers });
        }
    } catch (err) {
        return NextResponse.json({ err: getSafeError(err) }, { status: 403 });
    }
}
