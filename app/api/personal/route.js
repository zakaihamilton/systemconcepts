import { NextResponse } from "next/server";
import { handleRequest } from "@util/mongo";
import { login } from "@util/login";
import parseCookie from "@util/cookie";
import { getSafeError } from "@util/safeError";

export const dynamic = "force-dynamic";

async function handlePersonal(request) {
    try {
        const cookieHeader = request.headers.get("cookie") || "";
        const cookies = parseCookie(cookieHeader);
        const { id, hash } = cookies || {};

        let body = null;
        try { body = await request.json(); } catch { body = null; }

        const bodyObj = (body && Array.isArray(body)) ? (body[0] || {}) : (body || {});
        let path = bodyObj.id || bodyObj.folder || bodyObj.path || "";

        if (!path) {
            const headerIdVal = request.headers.get("id");
            if (headerIdVal) {
                path = decodeURIComponent(headerIdVal);
            } else {
                const queryHeader = request.headers.get("query");
                if (queryHeader) {
                    try {
                        const query = JSON.parse(decodeURIComponent(queryHeader));
                        path = query.folder || query.id || "";
                    } catch (e) {
                        console.error("[Personal API] Failed to parse query header:", e);
                    }
                }
            }
        }

        await login({ id, hash, api: "personal", path });

        const url = new URL(request.url);
        const req = {
            method: request.method,
            headers: Object.fromEntries(request.headers.entries()),
            body,
            query: Object.fromEntries(url.searchParams.entries()),
        };

        const result = await handleRequest({ collectionName: "fs_" + id.toLowerCase(), req, readOnly: false });
        return NextResponse.json(result);
    } catch (err) {
        console.error("personal error: ", err);
        return NextResponse.json({ err: getSafeError(err) }, { status: 403 });
    }
}

export async function GET(request) { return handlePersonal(request); }
export async function PUT(request) { return handlePersonal(request); }
export async function POST(request) { return handlePersonal(request); }
export async function DELETE(request) { return handlePersonal(request); }
