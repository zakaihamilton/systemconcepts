import { MongoClient } from "mongodb";

async function main() {
	if (!process.env.MONGO_URL) throw new Error("MONGO_URL is required");
	const client = await MongoClient.connect(process.env.MONGO_URL, {
		maxPoolSize: 1,
	});
	try {
		const db = client.db(process.env.MONGO_DB);
		await Promise.all([
			db
				.collection("users")
				.createIndex({ id: 1 }, { unique: true, name: "users_id_unique" }),
			db
				.collection("auth_sessions")
				.createIndex({ id: 1 }, { unique: true, name: "sessions_id_unique" }),
			db
				.collection("auth_sessions")
				.createIndex({ userId: 1 }, { name: "sessions_user_id" }),
			db
				.collection("auth_sessions")
				.createIndex(
					{ expiresAt: 1 },
					{ expireAfterSeconds: 0, name: "sessions_expiry" },
				),
			db
				.collection("challenges")
				.createIndex(
					{ userId: 1, type: 1 },
					{ unique: true, name: "challenges_user_type_unique" },
				),
			db
				.collection("challenges")
				.createIndex(
					{ createdAt: 1 },
					{ expireAfterSeconds: 900, name: "challenges_expiry" },
				),
			db
				.collection("rate_limits")
				.createIndex(
					{ ip: 1 },
					{ unique: true, name: "rate_limits_ip_unique" },
				),
			db
				.collection("rate_limits")
				.createIndex(
					{ resetTime: 1 },
					{ expireAfterSeconds: 0, name: "rate_limits_expiry" },
				),
		]);
	} finally {
		await client.close();
	}
	console.log("MongoDB indexes are ready.");
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
