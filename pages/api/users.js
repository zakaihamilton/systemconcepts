import { handleRequest } from "@/util/mongo";
import { login } from "@/util/login";
import { roleAuth } from "@/util/roles";
import Cookie from "cookie";

const collectionName = "users";

export default async (req, res) => {
    try {
        const { headers } = req || {};
        const { cookie } = headers || {};
        const cookies = Cookie.parse(cookie);
        const { id, hash } = cookies || {};
        if (!id || !hash) {
            throw "ACCESS_DENIED";
        }
        user = await login({ id, hash });
        if (!roleAuth(user && user.role, "admin")) {
            throw "ACCESS_DENIED";
        }
        const result = await handleRequest({ collectionName, req });
        res.status(200).json(result);
    }
    catch (err) {
        console.error("login error: ", err);
        res.status(401).json({ err: err.toString() });
    }
};
