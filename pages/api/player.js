import { cdnUrl } from "@/util/aws";
import { login } from "../../src/util/login";
import Cookie from "cookie";
import { roleAuth } from "@/util/roles";

export default async (req, res) => {
    try {
        const { headers } = req || {};
        const { cookie, path } = headers || {};
        const cookies = Cookie.parse(cookie);
        const { id, hash } = cookies || {};
        if (!id || !hash) {
            throw "ACCESS_DENIED";
        }
        const user = await login({ id, hash });
        if (!user) {
            throw "ACCESS_DENIED";
        }
        if (roleAuth(user.role, "student")) {
            throw "ACCESS_DENIED";
        }
        res.status(200).json({ path: cdnUrl(decodeURIComponent(path)) });
    }
    catch (err) {
        console.error("login error: ", err);
        res.status(401).json({ err: err.toString() });
    }
};
