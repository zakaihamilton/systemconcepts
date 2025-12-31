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
            throw "ACCESS_DENIED";
        }
        const body = (req.body && Array.isArray(req.body)) ? (req.body[0] || {}) : (req.body || {});
        let path = body.path || (req.headers && req.headers.path) || "";
        if (path) {
            path = decodeURIComponent(path);
        }
        const user = await login({ id, hash, api: "aws", path });
        if (!user) {
            throw "ACCESS_DENIED";
        }
        console.log(`[AWS API] User: ${user.id}, Role: ${user.role}, Method: ${req.method}, Path: ${path}`);

        // Determine access level
        const isLocalHost = req.headers.host && req.headers.host.includes("localhost");
        const isAdmin = roleAuth(user.role, "admin") || isLocalHost;
        const readOnly = !isAdmin; // Admins can write, non-admins are read-only

        if (isAdmin && isLocalHost) {
            console.log(`[AWS API] Granted ADMIN access via localhost bypass for user: ${user.id}`);
        }


        const result = await handleRequest({ req, readOnly });
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
            sizeLimit: "5mb",
        }
    }
};