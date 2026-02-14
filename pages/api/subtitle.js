import { downloadData } from "@util/aws";
import { login } from "@util/login";
import parseCookie from "@util/cookie";
import { roleAuth } from "@util/roles";
import { error } from "@util/logger";

const component = "subtitle";

export default async function SUBTITLE_API(req, res) {
    try {
        const { query, headers } = req;
        const { path } = query;
        const { cookie } = headers || {};

        if (!cookie) throw "ACCESS_DENIED";
        const cookies = parseCookie(cookie);
        const { id, hash } = cookies || {};
        const user = await login({ id, hash, api: "subtitle" });
        if (!user || !roleAuth(user.role, "student")) throw "ACCESS_DENIED";

        let decodedPath = decodeURIComponent(path);

        // Ensure we are reading from DigitalOcean (no wasabi flag)
        const data = await downloadData({ path: decodedPath });

        res.setHeader("Content-Type", "text/vtt");
        res.status(200).send(data);

    } catch (err) {
        error({ component, error: "Subtitle fetch error", err });
        res.status(404).end();
    }
}