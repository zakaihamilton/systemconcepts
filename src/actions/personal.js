"use server";
import { findRecord, listCollection, bulkWrite } from "@util/mongo";
import { login } from "@util/login";
import parseCookie from "@util/cookie";
import { getSafeError } from "@util/safeError";
import { headers } from "next/headers";

async function getContext(path) {
    const h = await headers();
    const cookie = h.get("cookie");
    const cookies = parseCookie(cookie);
    const { id, hash } = cookies || {};
    if (!id || !hash) {
        throw "ACCESS_DENIED";
    }
    await login({ id, hash, api: "personal", path });
    return { id };
}

export async function getPersonal(params) {
    try {
        const { id: queryId, query, fields, prefix, ids } = params;
        const { id: userId } = await getContext(queryId || (query && query.folder));
        const collectionName = "fs_" + userId.toLowerCase();

        if (ids && Array.isArray(ids)) {
             const maxBytes = 4000 * 1000;
             let records = await listCollection({
                    dbName: process.env.MONGO_DB, // mongo.js defaults this, but listCollection takes params
                    collectionName,
                    query: {
                        "id": {
                            "$in": ids
                        }
                    },
                    fields
             });
             if (!records) records = [];
             // Size check omitted for brevity/server action limit handling
             return records;
        }
        else if (queryId) {
             const result = await findRecord({ query: { id: queryId }, fields, collectionName });
             return result;
        } else if (prefix) {
             const safePrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
             const q = { id: { $regex: `^${safePrefix}` } };
             const result = await listCollection({ collectionName, query: q, fields });
             return result;
        } else {
             const result = await listCollection({ collectionName, query, fields });
             return result;
        }
    } catch (err) {
        console.error("getPersonal error:", err);
        return { err: getSafeError(err) };
    }
}

export async function updatePersonal(data) {
     try {
        const body = Array.isArray(data) ? data : [data];
        const path = body[0]?.id;
        const { id: userId } = await getContext(path);
        const collectionName = "fs_" + userId.toLowerCase();

        const operations = [];
        for (const record of body) {
            const { id } = record;
            if (typeof id !== "string") continue;

           const recordToSave = { ...record };
           delete recordToSave._id;
           operations.push({ replaceOne: { filter: { id }, replacement: recordToSave, upsert: true } });
        }
        await bulkWrite({ collectionName, operations, ordered: false });
        return {};

     } catch (err) {
         console.error("updatePersonal error:", err);
         return { err: getSafeError(err) };
     }
}
