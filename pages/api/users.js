import { handleRequest, findRecord, listCollection } from "@util/mongo";
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
            if (Array.isArray(body)) {
                const ids = body.map(i => i.id).filter(Boolean);
                const existing = await listCollection({ collectionName, query: { id: { $in: ids } } });
                const existingMap = new Map(existing.map(e => [e.id, e]));

                for (const item of body) {
                    const record = existingMap.get(item.id);
                    if (item.password) {
                        const { hash } = require("bcryptjs");
                        item.hash = await hash(item.password, 10);
                        delete item.password;
                    }
                    else if (record) {
                        item.hash = record.hash;
                    }
                    if (record) {
                        item.salt = record.salt;
                        if (!item.date) item.date = record.date;
                        if (!item.utc) item.utc = record.utc;
                        // Admins can update roles, so we don't force record.role unless not provided
                        if (!item.role) item.role = record.role;
                    }
                    else {
                        const dateObj = new Date();
                        item.date = dateObj.toString();
                        item.utc = dateObj.getTime();
                        if (!item.role) item.role = "visitor";
                    }
                }
            }
            else {
                const parsedId = queryId ? decodeURIComponent(queryId) : (body && body.id);
                const record = parsedId ? await findRecord({ query: { id: parsedId }, collectionName }) : null;

                if (body.password) {
                    const { hash } = require("bcryptjs");
                    body.hash = await hash(body.password, 10);
                    delete body.password;
                }
                else if (record) {
                    body.hash = record.hash;
                }

                if (record) {
                    body.salt = record.salt;
                    body.date = record.date;
                    body.utc = record.utc;
                    // Admins trigger this branch, so we DO NOT restore body.role from record.role,
                    // allowing the Admin's change to persist.
                }
                else {
                    const dateObj = new Date();
                    body.date = dateObj.toString();
                    body.utc = dateObj.getTime();
                    if (!body.role) body.role = "visitor";
                }
            }
        }
        const result = await handleRequest({ collectionName, req });
        const sanitizeUser = (user) => {
            if (!user) return user;
            const { hash: _hash, salt: _salt, resetToken: _resetToken, resetTokenExpiry: _resetTokenExpiry, credentials: _credentials, ...rest } = user;
            return rest;
        };
        const sanitizedResult = Array.isArray(result) ? result.map(sanitizeUser) : sanitizeUser(result);
        res.status(200).json(sanitizedResult);
    }
    catch (err) {
        console.error("users error: ", err);
        res.status(403).json({ err: getSafeError(err) });
    }
}
