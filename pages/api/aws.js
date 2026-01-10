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
        const path = decodeURIComponent((req.body && req.body.path) || (req.headers && req.headers.path));
        const user = await login({ id, hash, api: "aws", path });
        if (!user) {
            throw "ACCESS_DENIED";
        }

        // Determine access level
        const isAdmin = roleAuth(user.role, "admin");
        let readOnly = !isAdmin; // Admins can write, non-admins are read-only

        // Additional check: non-admins cannot write to shared metadata
        if (!readOnly && !isAdmin) {
            throw "ACCESS_DENIED";
        }

        // Sentinel: Pass the already-decoded path to handleRequest to ensure
        // the path we validated/logged (in login) is the exact same path used for the operation.
        // This prevents double-decoding vulnerabilities.
        const result = await handleRequest({ req, readOnly, path });
        if (typeof result === "object") {
            res.status(200).json(result);
        }
        else {
            res.status(200).end(result);
        }
    }
    catch (err) {
        console.error("login error: ", err);
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