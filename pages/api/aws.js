import { handleRequest } from "@util/aws";
import { login } from "@util/login";
import parseCookie from "@util/cookie";
import { roleAuth } from "@util/roles";
import { getSafeError } from "@util/safeError";

export default async function AWS_API(req, res) {
    try {
        const { headers } = req || {};
        const { cookie } = headers || {};
        const cookies = parseCookie(cookie);
        const { id, hash } = cookies || {};
        if (!id || !hash) {
            console.log(`[AWS API] ACCESS DENIED: No cookie found`);
            throw "ACCESS_DENIED";
        }
        const body = (req.body && Array.isArray(req.body)) ? (req.body[0] || {}) : (req.body || {});
        let path = body.path || (req.headers && req.headers.path) || req.query?.path || "";
        if (path) {
            path = decodeURIComponent(path);
        }
        const user = await login({ id, hash, api: "aws", path });
        if (!user) {
            console.log(`[AWS API] ACCESS DENIED: User ${id} is not authorized`);
            throw "ACCESS_DENIED";
        }
        console.log(`[AWS API] User: ${user.id}, Role: ${user.role}, Method: ${req.method}, Path: ${path}`);

        // Determine access level based on role and path
        const isAdmin = roleAuth(user.role, "admin");
        const isStudent = roleAuth(user.role, "student");

        let readOnly = true;
        const checkPath = path.replace(/^\//, "").replace(/^aws\//, "");

        if (isAdmin) {
            // Admins can read/write anywhere
            readOnly = false;
        } else if (isStudent) {
            // Students can read from /sync, read/write to /personal/<userid>
            const isPersonalPath = checkPath.startsWith(`personal/${user.id}/`) || checkPath === `personal/${user.id}`;
            const isSyncPath = checkPath.startsWith("sync/") || checkPath === "sync";
            const isLibraryPath = checkPath.startsWith("library/") || checkPath === "library";

            if (req.method === "GET") {
                // For GET requests, we must explicitly deny access to unauthorized paths.
                if (!isSyncPath && !isPersonalPath && !isLibraryPath) {
                    console.log(`[AWS API] ACCESS DENIED: User ${user.id} cannot read from path: ${path}`);
                    throw "ACCESS_DENIED: " + user.id + " cannot read from this path: " + path;
                }
                // readOnly remains true for GET, which is correct.
            } else if ((req.method === "PUT" || req.method === "DELETE") && isPersonalPath) {
                // Allow write/delete only to own personal directory
                readOnly = false;
            } else if (req.method !== "GET") {
                // Block writes to other paths
                console.log(`[AWS API] ACCESS DENIED: User ${user.id} cannot write to path: ${path}`);
                throw "ACCESS_DENIED: " + user.id + " cannot write to this path: " + path;
            }
        }
        else {
            throw "ACCESS_DENIED: " + user.id + " is not authorized";
        }

        console.log(`[AWS API] Access granted for user ${user.id} - ReadOnly: ${readOnly}, Path: ${path} Role: ${user.role} Method: ${req.method}`);

        const result = await handleRequest({ req, readOnly, path });

        if (checkPath.startsWith("sessions/")) {
            res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        }
        else {
            res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
            res.setHeader("Pragma", "no-cache");
            res.setHeader("Expires", "0");
        }

        if (Buffer.isBuffer(result)) {
            res.status(200).send(result);
        }
        else if (typeof result === "object") {
            res.status(200).json(result);
        }
        else {
            res.status(200).end(result);
        }
    }
    catch (err) {
        console.error("aws error: ", err);
        res.status(403).json({ err: getSafeError(err) });
    }
}

export const config = {
    api: {
        bodyParser: {
            sizeLimit: "50mb",
        },
        responseLimit: false,
    }
};