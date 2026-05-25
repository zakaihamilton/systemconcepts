const MongoClient = require("mongodb").MongoClient;
const { lockMutex } = require("@sync/mutex");

import { sanitizeQuery } from "@util/storage/mongoSanitize";
import { getSafeError } from "@util/api/safeError";

const _clusters = [];
const MAX_QUERY_LIMIT = 500;
const DEFAULT_QUERY_LIMIT = 500;
const MAX_BULK_RECORDS = 1000;
const MAX_RESPONSE_BYTES = 4000 * 1000;

export async function getCluster({ url = process.env.MONGO_URL }) {
	if (!url) {
		throw "Empty URI";
	}
	const unlock = await lockMutex({ id: "mongo" });
	try {
		let cluster = _clusters[url];
		if (!cluster) {
			console.log("connecting to database");
			cluster = _clusters[url] = await MongoClient.connect(url, {
				maxPoolSize: 10,
			});
			if (!cluster) {
				throw "Cannot connect to database";
			}
			console.log("connected to database");
		}
		return cluster;
	} finally {
		unlock();
	}
}

export async function getDatabase({
	dbName = process.env.MONGO_DB,
	...params
}) {
	const cluster = await getCluster({ ...params });
	const db = cluster.db(dbName);
	return db;
}

export async function getCollection({ dbName, collectionName, ...params }) {
	const db = await getDatabase({ dbName, ...params });
	const collection = db.collection(collectionName);
	return collection;
}

export async function listCollection({
	collectionName,
	query = {},
	fields,
	skip,
	limit,
	...params
}) {
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

export async function listCollections({ ...params }) {
	const db = await getDatabase({ ...params });
	const collections = await db.listCollections().toArray();
	const names = collections.map((collection) => collection.name);
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
		upsert: true,
	});
}

export async function bulkWrite({ operations, ordered, ...params }) {
	const collection = await getCollection(params);
	await collection.bulkWrite(operations, { ordered });
}

export async function handleRequest({ dbName, collectionName, readOnly, req }) {
	const headers = req.headers || {};
	const getHeader = (name) => headers[name] || headers[name.toLowerCase()];
	const parseLimit = (value, fallback) => {
		const parsed = Number.parseInt(value || "", 10);
		const safe = Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
		return Math.min(safe, MAX_QUERY_LIMIT);
	};
	const parseSkip = (value) => {
		const parsed = Number.parseInt(value || "", 10);
		return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
	};

	if (req.method === "GET" || req.method === "POST") {
		try {
			const body = req.body;
			const id = getHeader("id");
			const query = getHeader("query");
			const fields = getHeader("fields");
			const parsedId = id && decodeURIComponent(id);
			const parsedFields = fields && JSON.parse(decodeURIComponent(fields));
			if (Array.isArray(body)) {
				const ids = body
					.filter((item) => typeof item === "string")
					.slice(0, MAX_QUERY_LIMIT);
				let records = await listCollection({
					dbName,
					collectionName,
					query: {
						id: {
							$in: ids,
						},
					},
					fields: parsedFields,
				});
				if (!records) {
					records = [];
				}
				const results = [];
				let bytes = 2;
				for (const record of records) {
					const recordBytes = Buffer.byteLength(JSON.stringify(record)) + 1;
					if (bytes + recordBytes > MAX_RESPONSE_BYTES) {
						break;
					}
					results.push(record);
					bytes += recordBytes;
				}
				console.log(
					"found",
					results.length,
					"items for collection",
					collectionName,
					"fields",
					parsedFields,
				);
				return results;
			} else if (id) {
				const result = await findRecord({
					query: { id: parsedId },
					fields: parsedFields,
					dbName,
					collectionName,
				});
				console.log(
					"found an item for collection",
					collectionName,
					"id",
					parsedId,
				);
				return result;
			} else if (getHeader("prefix")) {
				const prefix = decodeURIComponent(getHeader("prefix"));
				const parsedFields = fields && JSON.parse(decodeURIComponent(fields));
				const escapeRegex = (string) =>
					string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
				const safePrefix = escapeRegex(prefix);
				const query = { id: { $regex: `^${safePrefix}` } };
				const result = await listCollection({
					dbName,
					collectionName,
					query,
					fields: parsedFields,
					limit: parseLimit(getHeader("limit"), DEFAULT_QUERY_LIMIT),
				});
				console.log(
					"found",
					result.length,
					"items with prefix",
					prefix,
					"for collection",
					collectionName,
				);
				return result;
			} else {
				const parsedQuery = query && JSON.parse(decodeURIComponent(query));
				sanitizeQuery(parsedQuery);
				const skip = parseSkip(getHeader("skip"));
				const limit = parseLimit(getHeader("limit"), DEFAULT_QUERY_LIMIT);
				let result = await listCollection({
					dbName,
					collectionName,
					query: parsedQuery,
					fields: parsedFields,
					skip,
					limit,
				});
				if (!result) {
					result = [];
				}
				console.log(
					"found",
					result.length,
					"items for collection",
					collectionName,
				);
				return result;
			}
		} catch (err) {
			console.error("get error: ", err);
			return { err: getSafeError(err) };
		}
	} else if (!readOnly && (req.method === "PUT" || req.method === "DELETE")) {
		try {
			const result = req.body;
			let records = result;
			if (!Array.isArray(records)) {
				if (typeof records === "object" && records[collectionName]) {
					records = records[collectionName];
				} else {
					records = [result];
				}
			}
			if (records.length > MAX_BULK_RECORDS) {
				throw "TOO_MANY_RECORDS";
			}
			console.log("pushing " + records.length + " records");
			const operations = [];
			for (const record of records) {
				const { id } = record;
				if (typeof id !== "string") {
					continue;
				}
				delete record._id;
				console.log(id);
				if (req.method === "DELETE") {
					operations.push({ deleteOne: { filter: { id } } });
				} else {
					operations.push({
						replaceOne: { filter: { id }, replacement: record, upsert: true },
					});
				}
			}
			await bulkWrite({ dbName, collectionName, operations, ordered: false });
			return {};
		} catch (err) {
			console.error("put error: ", err);
			return { err: getSafeError(err) };
		}
	}
}
