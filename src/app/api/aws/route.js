import { handleRequest } from "@util/aws";
import { login } from "@util/login";
import parseCookie from "@util/cookie";
import { roleAuth } from "@util/roles";
import { getSafeError } from "@util/safeError";
import { NextResponse } from "next/server";

async function handler(req) {
    try {
        const method = req.method;
        const headers = {};
        req.headers.forEach((value, key) => {
            headers[key] = value;
        });

        const searchParams = req.nextUrl.searchParams;
        const query = {};
        searchParams.forEach((value, key) => {
            query[key] = value;
        });

        let body = {};
        if (method === "PUT" || method === "POST") {
            try {
                body = await req.json();
            } catch (_e) {
                // If parsing fails, body remains empty object or handled as null depending on need.
                // handleRequest expects body for PUT.
                // If it's a file upload not via JSON? `aws.js` seems to expect JSON body with `path` and `body` fields for PUT.
                // `src/util/aws.js`: `let { body, path: itemPath } = item;`
            }
        }

        const legacyReq = {
            method,
            headers,
            query,
            body
        };

        const { cookie } = headers || {};
        const cookies = parseCookie(cookie);
        const { id, hash } = cookies || {};
        if (!id || !hash) {
            console.log(`[AWS API] ACCESS DENIED: No cookie found`);
            throw "ACCESS_DENIED";
        }

        // Logic from pages/api/aws.js
        const bodyObj = (body && Array.isArray(body)) ? (body[0] || {}) : (body || {});
        let path = bodyObj.path || (headers && headers.path) || query.path || "";

        if (path) {
            path = decodeURIComponent(path);
        }

        const user = await login({ id, hash, api: "aws", path });
        if (!user) {
            console.log(`[AWS API] ACCESS DENIED: User ${id} is not authorized`);
            throw "ACCESS_DENIED";
        }

        console.log(`[AWS API] User: ${user.id}, Role: ${user.role}, Method: ${method}, Path: ${path}`);
        console.log(`[AWS API] Request headers:`, { type: headers.type, binary: headers.binary, exists: headers.exists });

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

        // 1. Validate the primary path
        if (!validateUserAccess(user, path, method)) {
            console.log(`[AWS API] ACCESS DENIED: User ${user.id} cannot ${method} path: ${path}`);
            throw "ACCESS_DENIED: " + user.id + " cannot " + method + " path: " + path;
        }

        // 2. SENTINEL: If Batch PUT, validate all item paths
        if (method === "PUT" && Array.isArray(body)) {
            for (const item of body) {
                let itemPath = item.path || "";
                if (itemPath) itemPath = decodeURIComponent(itemPath);
                if (!validateUserAccess(user, itemPath, method)) {
                    console.log(`[AWS API] ACCESS DENIED: User ${user.id} cannot ${method} batch item path: ${itemPath}`);
                    throw "ACCESS_DENIED: Batch item unauthorized for path: " + itemPath;
                }
            }
        }

        let readOnly = true;
        const checkPath = path.replace(/^\//, "").replace(/^aws\//, "");

        if (method === "PUT" || method === "DELETE") {
            readOnly = false;
        }

        console.log(`[AWS API] Access granted for user ${user.id} - ReadOnly: ${readOnly}, Path: ${path} Role: ${user.role} Method: ${method}`);

        const result = await handleRequest({ req: legacyReq, readOnly, path });

        const isDir = (query && query.type === "dir") || (headers && headers.type === "dir");
        const isExists = (query && query.exists) || (headers && headers.exists);

        let responseHeaders = {};
        if (checkPath.startsWith("sessions/") && !isDir && !isExists) {
            responseHeaders["Cache-Control"] = "public, max-age=31536000, immutable";
        } else {
            responseHeaders["Cache-Control"] = "no-store, no-cache, must-revalidate, proxy-revalidate";
            responseHeaders["Pragma"] = "no-cache";
            responseHeaders["Expires"] = "0";
        }

        if (Buffer.isBuffer(result)) {
            return new NextResponse(result, { status: 200, headers: responseHeaders });
        }
        else if (typeof result === "object") {
            return NextResponse.json(result, { status: 200, headers: responseHeaders });
        }
        else {
            return new NextResponse(result, { status: 200, headers: responseHeaders });
        }

    } catch (err) {
        console.error("aws error: ", err);
        return NextResponse.json({ err: getSafeError(err) }, { status: 403 });
    }
}

export { handler as GET, handler as POST, handler as PUT, handler as DELETE };
