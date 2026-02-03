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
        // Decode path here for access control checks (startsWith, etc. require decoded path)
        if (path) {
            path = decodeURIComponent(path);
        }
        const user = await login({ id, hash, api: "aws", path });
        if (!user) {
            console.log(`[AWS API] ACCESS DENIED: User ${id} is not authorized`);
            throw "ACCESS_DENIED";
        }
        console.log(`[AWS API] User: ${user.id}, Role: ${user.role}, Method: ${req.method}, Path: ${path}`);
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
        if (!validateUserAccess(user, path, req.method)) {
            console.log(`[AWS API] ACCESS DENIED: User ${user.id} cannot ${req.method} path: ${path}`);
            throw "ACCESS_DENIED: " + user.id + " cannot " + req.method + " path: " + path;
        }

        // 2. SENTINEL: If Batch PUT, validate all item paths to prevent Mass Assignment/Bypass
        if (req.method === "PUT" && Array.isArray(req.body)) {
            for (const item of req.body) {
                let itemPath = item.path || "";
                if (itemPath) itemPath = decodeURIComponent(itemPath);
                if (!validateUserAccess(user, itemPath, req.method)) {
                    console.log(`[AWS API] ACCESS DENIED: User ${user.id} cannot ${req.method} batch item path: ${itemPath}`);
                    throw "ACCESS_DENIED: Batch item unauthorized";
                }
            }
        }

        let readOnly = true;
        const checkPath = path.replace(/^\//, "").replace(/^aws\//, "");

        if (req.method === "PUT" || req.method === "DELETE") {
            // We validated access above, so we can allow write.
            readOnly = false;
        }

        console.log(`[AWS API] Access granted for user ${user.id} - ReadOnly: ${readOnly}, Path: ${path} Role: ${user.role} Method: ${req.method}`);

        const result = await handleRequest({ req, readOnly, path });

        const isDir = (req.query && req.query.type === "dir") || (headers && headers.type === "dir");
        const isExists = (req.query && req.query.exists) || (headers && headers.exists);

        if (checkPath.startsWith("sessions/") && !isDir && !isExists) {
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