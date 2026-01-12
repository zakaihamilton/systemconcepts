import { handleRequest, findRecord } from "@util/mongo";
import { login } from "@util/login";
import { roleAuth } from "@util/roles";
import parseCookie from "@util/cookie";
import { getSafeError } from "@util/safeError";

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
                // SENTINEL: Restore sensitive fields from DB record to prevent Mass Assignment
                // This ensures a user cannot overwrite their password, role, or other critical fields
                // by simply including them in the PUT body.
                body.hash = record.hash;
                body.salt = record.salt;
                body.role = record.role;
                body.credentials = record.credentials;
                body.resetToken = record.resetToken;
                body.resetTokenExpiry = record.resetTokenExpiry;
                body.date = record.date;
                body.utc = record.utc;
            }
        }
        else if (req.method === "PUT") {
            const body = req.body;
            const parsedId = decodeURIComponent(queryId);
            const record = await findRecord({ query: { id: parsedId }, collectionName });
            if (record) {
                body.hash = record.hash;
                body.salt = record.salt;
                body.date = record.date;
                body.utc = record.utc;
                // Admins trigger this branch, so we DO NOT restore body.role from record.role,
                // allowing the Admin's change to persist.
            }
        }
        const result = await handleRequest({ collectionName, req });
        res.status(200).json(result);
    }
    catch (err) {
        console.error("users error: ", err);
        res.status(403).json({ err: getSafeError(err) });
    }
}
