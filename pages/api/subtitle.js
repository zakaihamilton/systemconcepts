import { downloadData, validatePathAccess } from "@util-legacy/aws";
import { login } from "@util-legacy/login";
import parseCookie from "@util-legacy/cookie";
import { roleAuth } from "@util-legacy/roles";
import { error } from "@util-legacy/logger";

const component = "subtitle";

export default async function SUBTITLE_API(req, res) {
    try {
        const { query } = req;
        const { path } = query;

        const { headers } = req || {};
        const { cookie } = headers || {};
        if (!cookie) {
            throw "ACCESS_DENIED";
        }
        const cookies = parseCookie(cookie);
        const { id, hash } = cookies || {};
        if (!id || !hash) {
            throw "ACCESS_DENIED";
        }
        const user = await login({ id, hash, api: "subtitle" });
        if (!user) {
            throw "ACCESS_DENIED";
        }
        if (!roleAuth(user.role, "student")) {
            throw "ACCESS_DENIED";
        }

        const decodedPath = decodeURIComponent(path);
        validatePathAccess(decodedPath);
        const data = await downloadData({ path: decodedPath });
        res.setHeader("Content-Type", "text/vtt");
        res.status(200).send(data);
    }
    catch (err) {
        error({ component, error: "error", err });
        res.status(404).end();
    }
}
