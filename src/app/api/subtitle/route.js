import { downloadData, validatePathAccess } from "@util/aws";
import { login } from "@util/login";
import parseCookie from "@util/cookie";
import { roleAuth } from "@util/roles";
import { error } from "@util/logger";
import { NextResponse } from "next/server";

const component = "subtitle";

export async function GET(req) {
    try {
        const path = req.nextUrl.searchParams.get("path");
        const headers = req.headers;
        const cookie = headers.get("cookie");

        if (!cookie) {
            throw "ACCESS_DENIED";
        }
        const cookies = parseCookie(cookie);
        const { id, hash } = cookies || {};
        if (!id || !hash) {
            throw "ACCESS_DENIED";
        }
        const user = await login({ id, hash, api: "subtitle" });
        if (!user) {
            throw "ACCESS_DENIED";
        }
        if (!roleAuth(user.role, "student")) {
            throw "ACCESS_DENIED";
        }

        validatePathAccess(path);
        const data = await downloadData({ path });

        return new NextResponse(data, {
            status: 200,
            headers: {
                "Content-Type": "text/vtt"
            }
        });
    } catch (err) {
        error({ component, error: "error", err });
        return new NextResponse(null, { status: 404 });
    }
}
