import { MongoClient } from "mongodb";
import { compare, hash } from "bcryptjs";

// --- Data: roles ---
const roles = [
    {
        id: "visitor",
        name: "VISITOR",
        level: 1
    },
    {
        id: "student",
        name: "STUDENT",
        level: 2
    },
    {
        id: "upper",
        name: "UPPER",
        level: 3
    },
    {
        id: "teacher",
        name: "TEACHER",
        level: 4
    },
    {
        id: "admin",
        name: "ADMIN",
        level: 5
    }
];

// --- Helper: safeError ---
function getSafeError(err) {
    const mapping = {
        "RATE_LIMIT_EXCEEDED": "Too many attempts, please try again later"
    };
    if (mapping[err]) {
        return mapping[err];
    }
    if (typeof err === "string") {
        return err;
    }
    return "INTERNAL_ERROR";
}

// --- Helper: roleAuth ---
function roleAuth(roleId, compareId) {
    const role = roles.find(role => role.id === roleId);
    const compare = roles.find(role => role.id === compareId);
    if (!role || !compare) {
        return false;
    }
    return role.level >= compare.level;
}

// --- Helper: cookie ---
function parseCookie(cookieHeader) {
    if (!cookieHeader) return {};

    const cookies = {};
    cookieHeader.split(';').forEach(cookieStr => {
        const [name, value] = cookieStr.trim().split('=');
        if (name && value) {
            cookies[name] = value;
        }
    });
    return cookies;
}

// --- Helper: mongoSanitize ---
function sanitizeQuery(query) {
    if (!query) return query;
    if (typeof query !== 'object') return query;

    // Iterate over array items if it's an array
    if (Array.isArray(query)) {
        for (const item of query) {
            sanitizeQuery(item);
        }
        return query;
    }

    for (const key in query) {
        // Check for dangerous operators
        if (key.startsWith('$')) {
            // Block ALL operators starting with $ to be safe
            throw new Error("Invalid query operator: " + key);
        }

        // Recursively check nested objects
        if (typeof query[key] === 'object' && query[key] !== null) {
            sanitizeQuery(query[key]);
        }
    }
    return query;
}

// --- Helper: mutex ---
const locks = {};

function getMutex({ id }) {
    var lock = locks[id];
    if (!lock) {
        lock = locks[id] = {};
        lock._locking = Promise.resolve();
        lock._locks = 0;
        lock._disabled = false;
        lockMutex({ id }).then(unlock => {
            if (lock._disabled) {
                lock._disabled = unlock;
            } else {
                unlock();
            }
        });
    }
    return lock;
}

function isMutexLocked({ id }) {
    var lock = getMutex({ id });
    if (lock) {
        return lock._locks > 0;
    }
}

function lockMutex({ id }) {
    var lock = getMutex({ id });
    if (lock) {
        lock._locks += 1;
        let unlockNext;
        let willLock = new Promise(resolve => unlockNext = () => {
            lock._locks -= 1;
            resolve();
        });
        let willUnlock = lock._locking.then(() => unlockNext);
        lock._locking = lock._locking.then(() => willLock);
        return willUnlock;
    }
}

// --- Helper: mongo ---
const _clusters = [];

async function getCluster({ url = process.env.MONGO_URL }) {
    if (!url) {
        throw "Empty URI";
    }
    const unlock = await lockMutex({ id: "mongo" });
    let cluster = _clusters[url];
    if (!cluster) {
        console.log("connecting to database");
        cluster = _clusters[url] = await MongoClient.connect(url);
        if (!cluster) {
            throw "Cannot connect to database, url: " + url;
        }
        console.log("connected to database: " + url);
    }
    unlock();
    return cluster;
}

async function getDatabase({ dbName = process.env.MONGO_DB, ...params }) {
    const cluster = await getCluster({ ...params });
    const db = cluster.db(dbName);
    return db;
}

async function getCollection({ dbName, collectionName, ...params }) {
    const db = await getDatabase({ dbName, ...params });
    const collection = db.collection(collectionName);
    return collection;
}

async function listCollection({ collectionName, query = {}, fields, skip, limit, ...params }) {
    const collection = await getCollection({ collectionName, ...params });
    let cursor = collection.find(query, fields);
    if (fields) {
        cursor = cursor.project(fields);
    }
    if (skip !== undefined) {
        cursor = cursor.skip(skip);
    }
    if (limit !== undefined) {
        cursor = cursor.limit(limit);
    }
    const results = await cursor.toArray();
    return results;
}

async function listCollections({ ...params }) {
    const db = await getDatabase({ ...params });
    const collections = await db.listCollections().toArray();
    const names = collections.map(collection => collection.name);
    return names;
}

async function insertRecord({ record, ...params }) {
    const collection = await getCollection(params);
    await collection.insertOne(record);
}

async function findRecord({ query, fields, ...params }) {
    const collection = await getCollection(params);
    return await collection.findOne(query, fields);
}

async function deleteRecord({ query, ...params }) {
    const collection = await getCollection(params);
    await collection.deleteOne(query);
}

async function replaceRecord({ query, record, ...params }) {
    const collection = await getCollection(params);
    await collection.replaceOne(query, record, {
        upsert: true
    });
}

async function bulkWrite({ operations, ordered, ...params }) {
    const collection = await getCollection(params);
    await collection.bulkWrite(operations, { ordered });
}

// Helper to safely retrieve single header value from potentially array-typed headers
const getFirstHeader = (headers, key) => {
    if (!headers || !headers[key]) return undefined;
    const val = headers[key];
    return Array.isArray(val) ? val[0] : val;
};

async function handleRequest({ dbName, collectionName, readOnly, req }) {
    const headers = req.headers || {};
    if (req.method === "GET" || req.method === "POST") {
        try {
            const body = req.body;
            const id = getFirstHeader(headers, 'id');
            const query = getFirstHeader(headers, 'query');
            const fields = getFirstHeader(headers, 'fields');
            const prefix = getFirstHeader(headers, 'prefix');
            const skip = getFirstHeader(headers, 'skip');
            const limit = getFirstHeader(headers, 'limit');

            const parsedId = id && decodeURIComponent(id);
            const parsedFields = fields && JSON.parse(decodeURIComponent(fields));

            if (Array.isArray(body)) {
                const maxBytes = 4000 * 1000;
                let records = await listCollection({
                    dbName, collectionName, query: {
                        "id": {
                            "$in": body
                        }
                    }, fields: parsedFields
                });
                if (!records) {
                    records = [];
                }
                const results = [];
                for (const record of records) {
                    if (JSON.stringify(results).length > maxBytes) {
                        break;
                    }
                    results.push(record);
                }
                console.log("found", results.length, "items for collection", collectionName, "fields", parsedFields);
                return results;
            }
            else if (id) {
                const result = await findRecord({ query: { id: parsedId }, fields: parsedFields, dbName, collectionName });
                console.log("found an item for collection", collectionName, "id", parsedId);
                return result;
            }
            else if (prefix) {
                const decodedPrefix = decodeURIComponent(prefix);
                const escapeRegex = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const safePrefix = escapeRegex(decodedPrefix);
                const query = { id: { $regex: `^${safePrefix}` } };
                const result = await listCollection({
                    dbName,
                    collectionName,
                    query,
                    fields: parsedFields
                });
                console.log("found", result.length, "items with prefix", decodedPrefix, "for collection", collectionName);
                return result;
            }
            else {
                const parsedQuery = query && JSON.parse(decodeURIComponent(query));
                sanitizeQuery(parsedQuery);
                const parsedSkip = skip ? parseInt(skip) : undefined;
                const parsedLimit = limit ? parseInt(limit) : undefined;
                let result = await listCollection({
                    dbName,
                    collectionName,
                    query: parsedQuery,
                    fields: parsedFields,
                    skip: parsedSkip,
                    limit: parsedLimit
                });
                if (!result) {
                    result = [];
                }
                console.log("found", result.length, "items for collection", collectionName);
                return result;
            }
        }
        catch (err) {
            console.error("get error: ", err);
            return { err: getSafeError(err) };
        }
    } else if (!readOnly && (req.method === "PUT" || req.method === "DELETE")) {
        try {
            const result = req.body;
            let records = [];

            if (Array.isArray(result)) {
                records = result;
            } else if (result && typeof result === "object") {
                if (Array.isArray(result[collectionName])) {
                    records = result[collectionName];
                } else {
                    records = [result];
                }
            } else {
                records = [result];
            }

            // Final safety check: ensure records is definitely an array
            if (!Array.isArray(records)) {
                records = [];
            }

            console.log("pushing " + records.length + " records");
            const operations = [];
            for (const record of records) {
                if (!record) continue;
                const { id } = record;
                if (typeof id !== "string") {
                    continue;
                }
                delete record._id;
                console.log(id);
                if (req.method === "DELETE") {
                    operations.push({ deleteOne: { filter: { id } } });
                }
                else {
                    operations.push({ replaceOne: { filter: { id }, replacement: record, upsert: true } });
                }
            }
            await bulkWrite({ dbName, collectionName, operations, ordered: false });
            return {};
        }
        catch (err) {
            console.error("put error: ", err);
            return { err: getSafeError(err) };
        }
    }
}

// --- Helper: login ---
async function login({ id, password, hash, api, path }) {
    if (!id) {
        console.error("empty user id");
        throw "USER_NOT_FOUND";
    }
    console.log("user:", id, "api:", api, "path", path);
    id = id.toLowerCase();
    let user = null;
    try {
        user = await findRecord({ collectionName: "users", query: { id } });
    }
    catch (err) {
        console.error("Error finding record for user", id, err);
        throw "USER_NOT_FOUND";
    }
    if (!user) {
        console.error("cannot find user for: ", id);
        throw "USER_NOT_FOUND";
    }
    if (password) {
        const result = await compare(password, user.hash);
        if (!result) {
            console.error("wrong password for user", id);
            throw "WRONG_PASSWORD";
        }
    }
    else if (hash !== user.hash) {
        console.error("wrong password for user", id);
        throw "WRONG_PASSWORD";
    }
    const dateObj = new Date();
    const date = dateObj.toString();
    const utc = dateObj.getTime();
    await replaceRecord({
        collectionName: "users",
        query: { id },
        record: {
            ...user,
            role: user.role || "visitor",
            date,
            utc
        }
    });
    // Ensure the returned user object also has the role
    if (!user.role) {
        user.role = "visitor";
    }
    return user;
}

// --- Main Handler ---
const collectionName = "users";

export default async function USERS_API(req, res) {
    try {
        const { headers } = req || {};
        const cookie = getFirstHeader(headers, 'cookie');
        const queryId = getFirstHeader(headers, 'id');

        const cookies = parseCookie(cookie);
        const { id, hash: userHash } = cookies || {};
        if (!id || !userHash) {
            throw "ACCESS_DENIED";
        }
        const user = await login({ id, hash: userHash, api: "users" });
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
            const parsedId = queryId ? decodeURIComponent(queryId) : (body && body.id);
            const record = parsedId ? await findRecord({ query: { id: parsedId }, collectionName }) : null;
            if (record) {
                if (body.password) {
                    body.hash = await hash(body.password, 10);
                    delete body.password;
                }
                else {
                    body.hash = record.hash;
                }
                body.salt = record.salt;
                body.date = record.date;
                body.utc = record.utc;
                // Admins trigger this branch, so we DO NOT restore body.role from record.role,
                // allowing the Admin's change to persist.
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
