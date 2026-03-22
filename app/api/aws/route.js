import { NextResponse } from "next/server";
import { handleRequest } from "@util/aws";
import { login } from "@util/login";
import parseCookie from "@util/cookie";
import { roleAuth } from "@util/roles";
import { getSafeError } from "@util/safeError";

export const dynamic = "force-dynamic";

const NO_CACHE_HEADERS = {
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    "Pragma": "no-cache",
    "Expires": "0",
};

async function handleAWS(request) {
    try {
        const cookieHeader = request.headers.get("cookie") || "";
        const cookies = parseCookie(cookieHeader);
        const { id, hash } = cookies || {};
        if (!id || !hash) {
            console.log(`[AWS API] ACCESS DENIED: No cookie found`);
            throw "ACCESS_DENIED";
        }

        let body = null;
        if (request.method === "PUT" || request.method === "DELETE") {
            try { body = await request.json(); } catch { body = null; }
        }

        const bodyObj = (body && Array.isArray(body)) ? (body[0] || {}) : (body || {});
        const url = new URL(request.url);
        let path = bodyObj.path || request.headers.get("path") || url.searchParams.get("path") || "";
        if (path) {
            path = decodeURIComponent(path);
        }

        const user = await login({ id, hash, api: "aws", path });
        if (!user) {
            console.log(`[AWS API] ACCESS DENIED: User ${id} is not authorized`);
            throw "ACCESS_DENIED";
        }
        console.log(`[AWS API] User: ${user.id}, Role: ${user.role}, Method: ${request.method}, Path: ${path}`);

        const validateUserAccess = (user, path, method) => {
            if (roleAuth(user.role, "admin")) return true;
            if (!path) return false;
            const checkPath = path.replace(/^\//, "").replace(/^aws\//, "");
            if (roleAuth(user.role, "student")) {
                const isPersonalPath = checkPath.startsWith(`personal/${user.id}/`) || checkPath === `personal/${user.id}`;
                if (method === "GET") {
                    const isSyncPath = checkPath.startsWith("sync/") || checkPath === "sync";
                    const isLibraryPath = checkPath.startsWith("library/") || checkPath === "library";
                    return isSyncPath || isPersonalPath || isLibraryPath;
                } else if (method === "PUT" || method === "DELETE") {
                    return isPersonalPath;
                }
            }
            return false;
        };

        if (!validateUserAccess(user, path, request.method)) {
            console.log(`[AWS API] ACCESS DENIED: User ${user.id} cannot ${request.method} path: ${path}`);
            throw "ACCESS_DENIED: " + user.id + " cannot " + request.method + " path: " + path;
        }

        if (request.method === "PUT" && Array.isArray(body)) {
            for (const item of body) {
                let itemPath = item.path || "";
                if (itemPath) itemPath = decodeURIComponent(itemPath);
                if (!validateUserAccess(user, itemPath, request.method)) {
                    console.log(`[AWS API] ACCESS DENIED: Batch item path: ${itemPath}`);
                    throw "ACCESS_DENIED: Batch item unauthorized for path: " + itemPath;
                }
            }
        }

        // Build a req-like object for handleRequest
        const req = {
            method: request.method,
            headers: Object.fromEntries(request.headers.entries()),
            body,
            query: Object.fromEntries(url.searchParams.entries()),
        };

        const result = await handleRequest({ req, readOnly: request.method === "GET", path });

        const headers = new Headers(NO_CACHE_HEADERS);

        if (Buffer.isBuffer(result)) {
            return new NextResponse(result, { status: 200, headers });
        } else if (typeof result === "object") {
            return NextResponse.json(result, { status: 200, headers });
        } else {
            return new NextResponse(result, { status: 200, headers });
        }
    } catch (err) {
        console.error("aws error: ", err);
        return NextResponse.json({ err: getSafeError(err) }, { status: 403 });
    }
}

export async function GET(request) { return handleAWS(request); }
export async function PUT(request) { return handleAWS(request); }
export async function DELETE(request) { return handleAWS(request); }
