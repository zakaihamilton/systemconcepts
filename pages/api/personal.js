import { handleRequest } from "@util/mongo";
import { login } from "@util/login";
import Cookie from "cookie";

export default async function PERSONAL_API(req, res) {
    try {
        const { headers } = req || {};
        const { cookie } = headers || {};
        const cookies = Cookie.parse(cookie);
        const { id, hash } = cookies || {};
        await login({ id, hash, api: "personal" });
        const result = await handleRequest({ collectionName: "fs_" + id.toLowerCase(), req, readOnly: false });
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