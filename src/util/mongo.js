const MongoClient = require("mongodb").MongoClient;
const { lockMutex } = require("./mutex");

const _clusters = [];

export async function getCluster({ url = process.env.MONGO_URL }) {
    if (!url) {
        throw "Empty URI";
    }
    let cluster = _clusters[url];
    if (!cluster) {
        const unlock = await lockMutex({ id: _clusters });
        cluster = _clusters[url] = await MongoClient.connect(url, { useNewUrlParser: true, useUnifiedTopology: true });
        if (!cluster) {
            throw "Cannot connect to database, url: " + url;
        }
        console.log("connected to database: " + url);
        unlock();
    }

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

export async function listCollection({ collectionName, ...params }) {
    const collection = await getCollection({ collectionName, ...params });
    const results = await collection.find({}).sort({ title: 1 }).toArray();
    return results;
}

export async function listCollections({ ...params }) {
    const db = await getDatabase({ ...params });
    const collections = await db.listCollections().toArray();
    const names = collections.map(collection => collection.name);
    return names;
}

export async function addRecord({ record, ...params }) {
    const collection = await getCollection(params);
    await collection.insert(record);
}

export async function findRecord({ query, ...params }) {
    const collection = await getCollection(params);
    return await collection.findOne(query);
}

export async function deleteRecord({ query, ...params }) {
    const collection = await getCollection(params);
    await collection.deleteOne(query);
}
