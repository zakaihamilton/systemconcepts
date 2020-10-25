import { cdnUrl } from "@util/aws";
import { login } from "@util/login";
import Cookie from "cookie";
import { roleAuth } from "@util/roles";
import { error, log } from "@util/logger";

const component = "player";

export default async (req, res) => {
    try {
        const { headers } = req || {};
        const { cookie, path } = headers || {};
        const cookies = Cookie.parse(cookie);
        const { id, hash } = cookies || {};
        if (!id || !hash) {
            error({ component, error: "No ID or hash provided in cookies" });
            throw "ACCESS_DENIED";
        }
        const user = await login({ id, hash, api: "player" });
        if (!user) {
            error({ component, error: `Cannot authorize user: ${id} in system` });
            throw "ACCESS_DENIED";
        }
        if (!roleAuth(user.role, "student")) {
            error({ component, error: `User: ${id} does not match the student role. role is: ${user.role}` });
            throw "ACCESS_DENIED";
        }
        const sessionUrl = cdnUrl(decodeURIComponent(path));
        log({ component, message: `User ${id} is playing session: ${sessionUrl}` });
        res.status(200).json({ path: sessionUrl });
    }
    catch (err) {
        error({ component, error: "login error", err });
        res.status(401).json({ err: err.toString() });
    }
};
