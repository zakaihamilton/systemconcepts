import { cdnUrl } from "@/util/aws";
import { login } from "../../src/util/login";
import Cookie from "cookie";
import { roleAuth } from "@/util/roles";

export default async (req, res) => {
    try {
        const { headers } = req || {};
        const { cookie } = headers || {};
        const cookies = Cookie.parse(cookie);
        const { id, hash, group, year, name } = cookies || {};
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
        const path = "sessions/" + decodeURIComponent(group) + "/" + year + "/" + decodeURIComponent(name);
        res.status(200).json({ path: cdnUrl(path) });
    }
    catch (err) {
        console.error("login error: ", err);
        res.status(401).json({ err: err.toString() });
    }
};
