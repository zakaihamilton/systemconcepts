import { handleRequest } from "@util/mongo";
import { login } from "@util/login";
import Cookie from "cookie";
import { roleAuth } from "@util/roles";

export default async function SHARED_API(req, res) {
    try {
        const { headers } = req || {};
        const { cookie } = headers || {};
        const cookies = Cookie.parse(cookie);
        const { id, hash } = cookies || {};
        let collectionName = "fs";
        let readOnly = true;
        if (!id || !hash) {
            throw "ACCESS_DENIED";
        }
        const user = await login({ id, hash, api: "shared" });
        if (!user) {
            throw "ACCESS_DENIED";
        }
        if (roleAuth(user.role, "admin")) {
            readOnly = false;
        } else if (!roleAuth(user.role, "student")) {
            throw "ACCESS_DENIED";
        }
        const result = await handleRequest({ collectionName, req, readOnly });
        res.status(200).json(result);
    }
    catch (err) {
        console.error("login error: ", err);
        res.status(403).json({ err: err.toString() });
    }
}

export const config = {
    api: {
        bodyParser: {
            sizeLimit: "5mb",
        }
    }
};