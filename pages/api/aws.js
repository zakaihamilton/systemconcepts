import { handleRequest } from "@/util/aws";
import { login } from "@/util/login";
import Cookie from "cookie";
import { roleAuth } from "@/util/roles";

export default async (req, res) => {
    try {
        const { headers } = req || {};
        const { cookie } = headers || {};
        const cookies = Cookie.parse(cookie);
        const { id, hash } = cookies || {};
        let readOnly = true;
        if (!id || !hash) {
            throw "ACCESS_DENIED";
        }
        const user = await login({ id, hash });
        if (!user) {
            throw "ACCESS_DENIED";
        }
        if (!roleAuth(user.role, "admin")) {
            throw "ACCESS_DENIED";
        }
        const result = await handleRequest({ req, readOnly });
        if (typeof result === "object") {
            res.status(200).json(result);
        }
        else {
            res.status(200).end(result);
        }
    }
    catch (err) {
        console.error("login error: ", err);
        res.status(401).json({ err: err.toString() });
    }
};

export const config = {
    api: {
        bodyParser: {
            sizeLimit: '5mb',
        }
    }
}