const MongoClient = require("mongodb").MongoClient;
const { lockMutex } = require("./mutex");

let clusters = null;

export async function getCluster({ url = process.env.MONGO_URL }) {
    if (!url) {
        throw "Empty URI";
    }
    let cluster = clusters[url];
    if (!cluster) {
        const unlock = await lockMutex();
        cluster = clusters[url] = await MongoClient.connect(url, { useNewUrlParser: true, useUnifiedTopology: true });
        console.log("connected to database: " + url);
        unlock();
    }

    return cluster;
}

export async function getDatabase({ dbName = process.env.MONGO_DB, ...params }) {
    const cluster = getCluster({ ...params });
    const db = await cluster.db(dbName);
    return db;
}

export async function getCollection({ dbName, ...params }) {
    const db = await getDatabase({ dbName, ...params });
    const collection = await db.collection(collectionName);
    return collection;
}

export async function listCollection({ collectionName, ...params }) {
    const collection = await getDatabase({ collectionName, ...params });
    const results = await collection.find({}).sort({ title: 1 }).toArray();
    return results;
}

export async function listCollections({ ...params }) {
    const db = await getDatabase({ ...params });
    const collections = await db.listCollections().toArray();
    const names = collections.map(collection => collection.name);
    return names;
}
