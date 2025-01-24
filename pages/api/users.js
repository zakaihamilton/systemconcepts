import { handleRequest, findRecord } from "@util/mongo";
import { login } from "@util/login";
import { roleAuth } from "@util/roles";
import parseCookie from "@util/cookie";

const collectionName = "users";

export default async function USERS_API(req, res) {
    try {
        const { headers } = req || {};
        const { cookie, id: queryId } = headers || {};
        const cookies = parseCookie(cookie);
        const { id, hash } = cookies || {};
        if (!id || !hash) {
            throw "ACCESS_DENIED";
        }
        const user = await login({ id, hash, api: "users" });
        if (!roleAuth(user && user.role, "admin")) {
            if (!queryId) {
                throw "ACCESS_DENIED";
            }
            const parsedId = decodeURIComponent(queryId);
            if (parsedId !== id) {
                throw "ACCESS_DENIED";
            }
            if (req.method === "PUT") {
                const body = req.body;
                const record = await findRecord({ query: { id: parsedId }, collectionName });
                if (record.id !== body.id || record.role !== body.role) {
                    throw "ACCESS_DENIED";
                }
            }
        }
        const result = await handleRequest({ collectionName, req });
        res.status(200).json(result);
    }
    catch (err) {
        console.error("login error: ", err);
        res.status(403).json({ err: err.toString() });
    }
}
