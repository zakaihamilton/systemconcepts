"use server";
import { findRecord, bulkWrite, listCollection } from "@util/mongo";
import { login } from "@util/login";
import { roleAuth } from "@util/roles";
import { getSafeError } from "@util/safeError";
import parseCookie from "@util/cookie";
import { headers } from "next/headers";
import bcrypt from "bcryptjs";

const collectionName = "users";

async function getContext() {
    const h = await headers();
    const cookie = h.get("cookie");
    const cookies = parseCookie(cookie);
    const { id, hash } = cookies || {};
    if (!id || !hash) {
        throw "ACCESS_DENIED";
    }
    const user = await login({ id, hash, api: "users" });
    return { user, id, hash };
}

function sanitize(result) {
    const sanitizeUser = (user) => {
        if (!user) return user;
        const { hash: _hash, salt: _salt, resetToken: _resetToken, resetTokenExpiry: _resetTokenExpiry, credentials: _credentials, ...rest } = user;
        return rest;
    };
    return Array.isArray(result) ? result.map(sanitizeUser) : sanitizeUser(result);
}

export async function getUsers({ id, query, fields, skip, limit, prefix } = {}) {
    try {
        const { user, id: userId } = await getContext();
        if (!roleAuth(user && user.role, "admin")) {
            if (!id) {
                 throw "ACCESS_DENIED";
            }
            if (id !== userId) {
                 throw "ACCESS_DENIED";
            }
        }

        if (id) {
            const result = await findRecord({ query: { id }, fields, collectionName });
            return sanitize(result);
        }
        else if (prefix) {
             const safePrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
             const q = { id: { $regex: `^${safePrefix}` } };
             const result = await listCollection({ collectionName, query: q, fields });
             return sanitize(result);
        }
        else {
            const result = await listCollection({ collectionName, query, fields, skip, limit });
            return sanitize(result);
        }
    } catch (err) {
        console.error("getUsers error: ", err);
        return { err: getSafeError(err) };
    }
}

export async function updateUsers(data) {
    try {
        const { user, id: userId } = await getContext();

        let records = Array.isArray(data) ? data : [data];

        if (!roleAuth(user && user.role, "admin")) {
            for (const body of records) {
                if (body.id !== userId) {
                    throw "ACCESS_DENIED";
                }
                const record = await findRecord({ query: { id: userId }, collectionName });
                if (record.id !== body.id || record.role !== body.role) {
                     throw "ACCESS_DENIED";
                }

                const allowedFields = ["firstName", "lastName", "email"];
                const safeBody = {};
                allowedFields.forEach(field => {
                    if (body[field] !== undefined) {
                        safeBody[field] = body[field];
                    }
                });

                Object.keys(body).forEach(key => delete body[key]);
                Object.assign(body, safeBody);

                body.id = userId;
                body.hash = record.hash;
                body.salt = record.salt;
                body.role = record.role;
                body.credentials = record.credentials;
                body.resetToken = record.resetToken;
                body.resetTokenExpiry = record.resetTokenExpiry;
                body.date = record.date;
                body.utc = record.utc;
            }
        } else {
             for (const body of records) {
                const record = await findRecord({ query: { id: body.id }, collectionName });
                if (record) {
                    if (body.password) {
                        body.hash = await bcrypt.hash(body.password, 10);
                        delete body.password;
                    } else {
                        body.hash = record.hash;
                        delete body.password;
                    }
                    body.salt = record.salt;
                    body.date = record.date;
                    body.utc = record.utc;
                }
             }
        }

        const operations = [];
        for (const record of records) {
            const { id } = record;
             if (typeof id !== "string") continue;
             const recordToSave = { ...record };
             delete recordToSave._id;
             operations.push({ replaceOne: { filter: { id }, replacement: recordToSave, upsert: true } });
        }
        await bulkWrite({ collectionName, operations, ordered: false });
        return {};
    } catch (err) {
         console.error("updateUsers error: ", err);
         return { err: getSafeError(err) };
    }
}

export async function deleteUsers(data) {
    try {
         const { user, id: userId } = await getContext();

         let records = Array.isArray(data) ? data : [data];

         if (!roleAuth(user && user.role, "admin")) {
             for (const record of records) {
                 if (record.id !== userId) throw "ACCESS_DENIED";
             }
         }

         const operations = [];
         for (const record of records) {
             const { id } = record;
             if (typeof id !== "string") continue;
             operations.push({ deleteOne: { filter: { id } } });
         }
         await bulkWrite({ collectionName, operations, ordered: false });
         return {};

    } catch (err) {
         console.error("deleteUsers error: ", err);
         return { err: getSafeError(err) };
    }
}
