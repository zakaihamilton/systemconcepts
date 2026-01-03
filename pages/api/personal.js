import { handleRequest } from "@util/mongo";
import { login } from "@util/login";
import parseCookie from "@util/cookie";
import { getSafeError } from "@util/safeError";

export default async function PERSONAL_API(req, res) {
    try {
        const { headers } = req || {};
        const { cookie: cookieHeader } = headers || {};
        const cookies = parseCookie(cookieHeader);
        const { id, hash } = cookies || {};

        // Extract path for logging - check various fields used by remote storage
        const body = (req.body && Array.isArray(req.body)) ? (req.body[0] || {}) : (req.body || {});
        let path = body.id || body.folder || body.path || "";

        // Also check headers (used for GET requests)
        if (!path && req.headers) {
            if (req.headers.id) {
                path = decodeURIComponent(req.headers.id);
            } else if (req.headers.query) {
                try {
                    const query = JSON.parse(decodeURIComponent(req.headers.query));
                    path = query.folder || query.id || "";
                } catch (e) { }
            }
        }

        await login({ id, hash, api: "personal", path });

        const result = await handleRequest({ collectionName: "fs_" + id.toLowerCase(), req, readOnly: false });
        res.status(200).json(result);
    }
    catch (err) {
        console.error("personal error: ", err);
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