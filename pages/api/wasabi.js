import { handleRequest } from "@util/wasabi";
import { login } from "@util/login";
import parseCookie from "@util/cookie";
import { roleAuth } from "@util/roles";
import { getSafeError } from "@util/safeError";

export default async function WASABI_API(req, res) {
    try {
        const { headers } = req || {};
        const { cookie } = headers || {};
        const cookies = parseCookie(cookie);
        const { id, hash } = cookies || {};
        if (!id || !hash) {
            throw "ACCESS_DENIED";
        }

        let path = (req.headers && req.headers.path) || req.query?.path || "";
        if (path) {
            path = decodeURIComponent(path);
        }

        const user = await login({ id, hash, api: "wasabi", path });
        if (!user || !roleAuth(user.role, "student")) {
            throw "ACCESS_DENIED";
        }

        if (req.method !== "GET") {
            throw "READ_ONLY_ACCESS";
        }

        const result = await handleRequest({ req, path });

        const isDir = (req.query && req.query.type === "dir") || (headers && headers.type === "dir");
        const isExists = (req.query && req.query.exists) || (headers && headers.exists);

        if (path.startsWith("sessions/") && !isDir && !isExists) {
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
        res.status(403).json({ err: getSafeError(err) });
    }
}

export const config = {
    api: {
        responseLimit: false,
    }
};
