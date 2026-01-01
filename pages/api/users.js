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

                // 🛡️ Sentinel Security Fix: Prevent Mass Assignment Vulnerability
                // Non-admin users should only be able to update specific fields (e.g. name, email, options).
                // We must preserve sensitive fields (hash, credentials, etc.) from the existing record
                // to prevent them from being overwritten or wiped by a partial update.

                // Merge body into record to allow updates
                const safeBody = {
                    ...record,
                    ...body
                };

                // Explicitly restore sensitive/system fields from the original record
                safeBody.id = record.id;
                safeBody.role = record.role;
                safeBody.hash = record.hash;
                safeBody.credentials = record.credentials; // Passkeys
                safeBody.resetToken = record.resetToken;
                safeBody.resetTokenExpiry = record.resetTokenExpiry;
                safeBody.date = record.date; // Last login date
                safeBody.utc = record.utc;   // Last login timestamp

                // Note: 'salt' is not stored separately in this system (part of hash), but if it were, we'd restore it too.

                // Update req.body to be the safe, full object for handleRequest (which does replaceOne)
                req.body = safeBody;
            }
        }
        const result = await handleRequest({ collectionName, req });
        res.status(200).json(result);
    }
    catch (err) {
        console.error("login error: ", err);
        res.status(403).json({ err: getSafeError(err) });
    }
}
