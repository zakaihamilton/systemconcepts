import {
	bulkWrite,
	deleteRecord,
	findRecord,
	getCluster,
	getCollection,
	getDatabase,
	handleRequest,
	insertRecord,
	listCollection,
	listCollections,
	replaceRecord,
} from "@util/storage/mongo";
import { MongoClient } from "mongodb";

jest.mock("mongodb", () => ({
	MongoClient: { connect: jest.fn() },
}));
jest.mock("@util/api/logger", () => ({
	logger: { debug: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const originalEnv = process.env;
const MAIN_URL = "mongodb://main-test-cluster";

function makeCursor(results) {
	const cursor = {
		project: jest.fn(() => cursor),
		skip: jest.fn(() => cursor),
		limit: jest.fn(() => cursor),
		toArray: jest.fn().mockResolvedValue(results),
	};
	return cursor;
}

let cluster;
let db;
let collection;

beforeEach(async () => {
	jest.clearAllMocks();
	process.env = { ...originalEnv, MONGO_URL: MAIN_URL, MONGO_DB: "main-db" };

	collection = {
		find: jest.fn(),
		insertOne: jest.fn().mockResolvedValue({}),
		findOne: jest.fn().mockResolvedValue(null),
		deleteOne: jest.fn().mockResolvedValue({}),
		replaceOne: jest.fn().mockResolvedValue({}),
		bulkWrite: jest.fn().mockResolvedValue({}),
	};
	db = {
		collection: jest.fn(() => collection),
		listCollections: jest.fn(() => ({
			toArray: jest.fn().mockResolvedValue([]),
		})),
	};
	cluster = cluster || { db: jest.fn() };
	cluster.db.mockReset();
	cluster.db.mockReturnValue(db);
	MongoClient.connect.mockResolvedValue(cluster);
	// Ensure the shared cluster is connected/cached for the main test URL.
	await getCluster({ url: MAIN_URL });
});

afterAll(() => {
	process.env = originalEnv;
});

describe("getCluster", () => {
	it("throws when no URI is available", async () => {
		delete process.env.MONGO_URL;
		await expect(getCluster({})).rejects.toBe("Empty URI");
	});

	it("connects once and caches the cluster for a given url", async () => {
		const url = "mongodb://cache-test-cluster";
		const freshCluster = { db: jest.fn() };
		MongoClient.connect.mockResolvedValue(freshCluster);

		const first = await getCluster({ url });
		const second = await getCluster({ url });

		expect(first).toBe(freshCluster);
		expect(second).toBe(freshCluster);
		expect(MongoClient.connect).toHaveBeenCalledTimes(1);
	});

	it("throws when the driver returns a falsy cluster", async () => {
		const url = "mongodb://falsy-cluster";
		MongoClient.connect.mockResolvedValue(null);

		await expect(getCluster({ url })).rejects.toBe(
			"Cannot connect to database",
		);
	});
});

describe("getDatabase / getCollection", () => {
	it("uses the default database name from the environment", async () => {
		await getDatabase({});

		expect(cluster.db).toHaveBeenCalledWith("main-db");
	});

	it("selects the requested collection", async () => {
		const result = await getCollection({ collectionName: "sessions" });

		expect(db.collection).toHaveBeenCalledWith("sessions");
		expect(result).toBe(collection);
	});
});

describe("listCollection", () => {
	it("applies projection, skip, and limit when provided", async () => {
		const cursor = makeCursor([{ id: "a" }]);
		collection.find.mockReturnValue(cursor);

		const results = await listCollection({
			collectionName: "sessions",
			query: { id: "a" },
			fields: { id: 1 },
			skip: 5,
			limit: 10,
		});

		expect(collection.find).toHaveBeenCalledWith({ id: "a" }, { id: 1 });
		expect(cursor.project).toHaveBeenCalledWith({ id: 1 });
		expect(cursor.skip).toHaveBeenCalledWith(5);
		expect(cursor.limit).toHaveBeenCalledWith(10);
		expect(results).toEqual([{ id: "a" }]);
	});

	it("skips optional cursor stages when not provided", async () => {
		const cursor = makeCursor([]);
		collection.find.mockReturnValue(cursor);

		await listCollection({ collectionName: "sessions" });

		expect(cursor.project).not.toHaveBeenCalled();
		expect(cursor.skip).not.toHaveBeenCalled();
		expect(cursor.limit).not.toHaveBeenCalled();
	});
});

describe("listCollections", () => {
	it("returns collection names", async () => {
		db.listCollections.mockReturnValue({
			toArray: jest
				.fn()
				.mockResolvedValue([{ name: "sessions" }, { name: "users" }]),
		});

		await expect(listCollections({})).resolves.toEqual(["sessions", "users"]);
	});
});

describe("record helpers", () => {
	it("insertRecord inserts the given record", async () => {
		await insertRecord({ record: { id: "a" }, collectionName: "sessions" });

		expect(collection.insertOne).toHaveBeenCalledWith({ id: "a" });
	});

	it("findRecord queries with fields", async () => {
		collection.findOne.mockResolvedValue({ id: "a" });

		const result = await findRecord({
			query: { id: "a" },
			fields: { id: 1 },
			collectionName: "sessions",
		});

		expect(collection.findOne).toHaveBeenCalledWith({ id: "a" }, { id: 1 });
		expect(result).toEqual({ id: "a" });
	});

	it("deleteRecord deletes matching documents", async () => {
		await deleteRecord({ query: { id: "a" }, collectionName: "sessions" });

		expect(collection.deleteOne).toHaveBeenCalledWith({ id: "a" });
	});

	it("replaceRecord upserts the replacement", async () => {
		await replaceRecord({
			query: { id: "a" },
			record: { id: "a", name: "test" },
			collectionName: "sessions",
		});

		expect(collection.replaceOne).toHaveBeenCalledWith(
			{ id: "a" },
			{ id: "a", name: "test" },
			{ upsert: true },
		);
	});

	it("bulkWrite forwards operations and ordering", async () => {
		const operations = [{ deleteOne: { filter: { id: "a" } } }];

		await bulkWrite({ operations, ordered: true, collectionName: "sessions" });

		expect(collection.bulkWrite).toHaveBeenCalledWith(operations, {
			ordered: true,
		});
	});
});

describe("handleRequest GET/POST", () => {
	it("resolves a batch of ids via $in and truncates oversized responses", async () => {
		const cursor = makeCursor([{ id: "a" }, { id: "b" }]);
		collection.find.mockReturnValue(cursor);

		const result = await handleRequest({
			collectionName: "sessions",
			req: { method: "POST", body: ["a", "b", 123] },
		});

		expect(collection.find).toHaveBeenCalledWith(
			{ id: { $in: ["a", "b"] } },
			undefined,
		);
		expect(result).toEqual([{ id: "a" }, { id: "b" }]);
	});

	it("defaults to an empty array when the id batch query yields no results", async () => {
		const cursor = makeCursor(null);
		collection.find.mockReturnValue(cursor);

		const result = await handleRequest({
			collectionName: "sessions",
			req: { method: "POST", body: ["a", "b"] },
		});

		expect(result).toEqual([]);
	});

	it("truncates the id batch response once it exceeds the byte limit", async () => {
		const bigRecord = { id: "a", blob: "x".repeat(4000 * 1000) };
		const cursor = makeCursor([bigRecord, { id: "b" }]);
		collection.find.mockReturnValue(cursor);

		const result = await handleRequest({
			collectionName: "sessions",
			req: { method: "POST", body: ["a", "b"] },
		});

		expect(result).toEqual([]);
	});

	it("looks up a single record by id header", async () => {
		collection.findOne.mockResolvedValue({ id: "abc" });

		const result = await handleRequest({
			collectionName: "sessions",
			req: { method: "GET", headers: { id: encodeURIComponent("abc") } },
		});

		expect(collection.findOne).toHaveBeenCalledWith({ id: "abc" }, undefined);
		expect(result).toEqual({ id: "abc" });
	});

	it("queries by escaped regex prefix", async () => {
		const cursor = makeCursor([{ id: "sessions.1" }]);
		collection.find.mockReturnValue(cursor);

		const result = await handleRequest({
			collectionName: "sessions",
			req: {
				method: "GET",
				headers: { prefix: encodeURIComponent("sessions.") },
			},
		});

		expect(collection.find).toHaveBeenCalledWith(
			{ id: { $regex: "^sessions\\." } },
			undefined,
		);
		expect(result).toEqual([{ id: "sessions.1" }]);
	});

	it("runs a sanitized query from the query header", async () => {
		const cursor = makeCursor([{ id: "a" }]);
		collection.find.mockReturnValue(cursor);
		const query = encodeURIComponent(JSON.stringify({ id: "a" }));

		const result = await handleRequest({
			collectionName: "sessions",
			req: { method: "GET", headers: { query } },
		});

		expect(result).toEqual([{ id: "a" }]);
	});

	it("returns an empty array when the query yields no results", async () => {
		const cursor = makeCursor(null);
		collection.find.mockReturnValue(cursor);

		const result = await handleRequest({
			collectionName: "sessions",
			req: { method: "GET", headers: {} },
		});

		expect(result).toEqual([]);
	});

	it("rejects dangerous query operators via sanitizeQuery", async () => {
		const query = encodeURIComponent(JSON.stringify({ $where: "1==1" }));

		const result = await handleRequest({
			collectionName: "sessions",
			req: { method: "GET", headers: { query } },
		});

		expect(result).toEqual({ err: expect.any(String) });
	});

	it("returns a safe error payload for unexpected failures", async () => {
		collection.find.mockImplementation(() => {
			throw new Error("boom");
		});

		const result = await handleRequest({
			collectionName: "sessions",
			req: { method: "GET", headers: {} },
		});

		expect(result).toEqual({ err: expect.any(String) });
	});
});

describe("handleRequest PUT/DELETE", () => {
	it("upserts an array of records with valid ids", async () => {
		const result = await handleRequest({
			collectionName: "sessions",
			req: {
				method: "PUT",
				body: [
					{ id: "a", name: "one" },
					{ id: "b", name: "two" },
					{ name: "missing-id" },
				],
			},
		});

		expect(result).toEqual({});
		expect(collection.bulkWrite).toHaveBeenCalledWith(
			[
				{
					replaceOne: {
						filter: { id: "a" },
						replacement: { id: "a", name: "one" },
						upsert: true,
					},
				},
				{
					replaceOne: {
						filter: { id: "b" },
						replacement: { id: "b", name: "two" },
						upsert: true,
					},
				},
			],
			{ ordered: false },
		);
	});

	it("unwraps records nested under the collection name", async () => {
		await handleRequest({
			collectionName: "sessions",
			req: {
				method: "PUT",
				body: { sessions: [{ id: "a" }] },
			},
		});

		expect(collection.bulkWrite).toHaveBeenCalledWith(
			[
				{
					replaceOne: {
						filter: { id: "a" },
						replacement: { id: "a" },
						upsert: true,
					},
				},
			],
			{ ordered: false },
		);
	});

	it("wraps a single record body into an array", async () => {
		await handleRequest({
			collectionName: "sessions",
			req: { method: "PUT", body: { id: "solo" } },
		});

		expect(collection.bulkWrite).toHaveBeenCalledWith(
			[
				{
					replaceOne: {
						filter: { id: "solo" },
						replacement: { id: "solo" },
						upsert: true,
					},
				},
			],
			{ ordered: false },
		);
	});

	it("builds deleteOne operations for DELETE requests", async () => {
		await handleRequest({
			collectionName: "sessions",
			req: { method: "DELETE", body: [{ id: "a" }] },
		});

		expect(collection.bulkWrite).toHaveBeenCalledWith(
			[{ deleteOne: { filter: { id: "a" } } }],
			{ ordered: false },
		);
	});

	it("rejects batches that exceed the maximum bulk size", async () => {
		const body = Array.from({ length: 1001 }, (_, i) => ({ id: `id-${i}` }));

		const result = await handleRequest({
			collectionName: "sessions",
			req: { method: "PUT", body },
		});

		expect(result).toEqual({ err: expect.any(String) });
		expect(collection.bulkWrite).not.toHaveBeenCalled();
	});

	it("does not process writes when readOnly is set", async () => {
		const result = await handleRequest({
			collectionName: "sessions",
			readOnly: true,
			req: { method: "PUT", body: { id: "a" } },
		});

		expect(result).toBeUndefined();
		expect(collection.bulkWrite).not.toHaveBeenCalled();
	});
});
