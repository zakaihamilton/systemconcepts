import { handleRequest } from "@util/mongo";
import { login } from "@util/login";
import parseCookie from "@util/cookie";
import { roleAuth } from "@util/roles";
import { getSafeError } from "@util/safeError";

export default async function CONTENT_API(req, res) {
    try {
        const { headers } = req || {};
        const { cookie } = headers || {};
        const cookies = parseCookie(cookie);
        const { id, hash } = cookies || {};
        let collectionName = "content";
        let readOnly = true;
        if (!id || !hash) {
            throw "ACCESS_DENIED";
        }
        const user = await login({ id, hash, api: "content" });
        if (!user) {
            throw "ACCESS_DENIED";
        }
        if (roleAuth(user.role, "upper")) {
            readOnly = false;
        } else if (!roleAuth(user.role, "student")) {
            throw "ACCESS_DENIED";
        }
        const result = await handleRequest({ collectionName, req, readOnly });
        res.status(200).json(result);
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