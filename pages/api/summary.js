import { downloadData } from "@util/aws";
import { login } from "@util/login";
import parseCookie from "@util/cookie";
import { roleAuth } from "@util/roles";
import { error } from "@util/logger";

const component = "summary";

export default async function SUMMARY_API(req, res) {
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
        const user = await login({ id, hash, api: "summary" });
        if (!user) {
            throw "ACCESS_DENIED";
        }
        if (!roleAuth(user.role, "student")) {
            throw "ACCESS_DENIED";
        }

        const data = await downloadData({ path: decodeURIComponent(path) });
        res.setHeader("Content-Type", "text/markdown");
        res.status(200).send(data);
    }
    catch (err) {
        error({ component, error: "error", err });
        res.status(404).end();
    }
}
