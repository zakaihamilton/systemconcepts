const MongoClient = require("mongodb").MongoClient;
const { lockMutex } = require("./mutex");

const _clusters = [];

export async function getCluster({ url = process.env.MONGO_URL }) {
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

export async function getDatabase({ dbName = process.env.MONGO_DB, ...params }) {
    const cluster = await getCluster({ ...params });
    const db = cluster.db(dbName);
    return db;
}

export async function getCollection({ dbName, collectionName, ...params }) {
    const db = await getDatabase({ dbName, ...params });
    const collection = db.collection(collectionName);
    return collection;
}

export async function listCollection({ collectionName, query = {}, fields, ...params }) {
    const collection = await getCollection({ collectionName, ...params });
    let cursor = collection.find(query, fields);
    if (fields) {
        cursor = cursor.project(fields);
    }
    const results = await cursor.toArray();
    return results;
}

export async function listCollections({ ...params }) {
    const db = await getDatabase({ ...params });
    const collections = await db.listCollections().toArray();
    const names = collections.map(collection => collection.name);
    return names;
}

export async function insertRecord({ record, ...params }) {
    const collection = await getCollection(params);
    await collection.insertOne(record);
}

export async function findRecord({ query, fields, ...params }) {
    const collection = await getCollection(params);
    return await collection.findOne(query, fields);
}

export async function deleteRecord({ query, ...params }) {
    const collection = await getCollection(params);
    await collection.deleteOne(query);
}

export async function replaceRecord({ query, record, ...params }) {
    const collection = await getCollection(params);
    await collection.replaceOne(query, record, {
        upsert: true
    });
}

export async function bulkWrite({ operations, ordered, ...params }) {
    const collection = await getCollection(params);
    await collection.bulkWrite(operations, { ordered });
}

export async function handleRequest({ dbName, collectionName, readOnly, req }) {
    const headers = req.headers || {};
    if (req.method === "GET" || req.method === "POST") {
        try {
            const body = req.body;
            const { id, query, fields } = headers;
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
                console.log("found an item for collection", collectionName, "id", parsedId, "fields", parsedFields);
                return result;
            }
            else {
                const parsedQuery = query && JSON.parse(decodeURIComponent(query));
                let result = await listCollection({ dbName, collectionName, query: parsedQuery, fields: parsedFields });
                if (!result) {
                    result = [];
                }
                console.log("found", result.length, "items for collection", collectionName, "query", parsedQuery, "fields", parsedFields);
                return result;
            }
        }
        catch (err) {
            console.error("get error: ", err);
            return { err: err.toString() };
        }
    } else if (!readOnly && (req.method === "PUT" || req.method === "DELETE")) {
        try {
            const result = req.body;
            let records = result;
            if (!Array.isArray(records)) {
                if (typeof records === "object" && records[collectionName]) {
                    records = records[collectionName];
                }
                else {
                    records = [result];
                }
            }
            console.log("pushing " + records.length + " records");
            const operations = [];
            for (const record of records) {
                const { id } = record;
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
            return { err: err.toString() };
        }
    }
}
