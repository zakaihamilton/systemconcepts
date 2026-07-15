import { getTrustedClientIp } from "@util/auth/requestSecurity";
import { getCollection } from "@util/storage/mongo";

export async function checkRateLimit(
	req = {},
	{ limit = 5, windowMs = 60 * 1000, key } = {},
) {
	let identifier;
	if (key) {
		identifier = String(key);
	} else {
		if (req.headers?.get) identifier = getTrustedClientIp(req);
		else identifier = "unknown";
	}

	const collectionName = "rate_limits";
	const now = Date.now();
	const collection = await getCollection({ collectionName });

	const record = await collection.findOneAndUpdate(
		{ ip: identifier },
		[
			{
				$set: {
					ip: identifier,
					resetTime: {
						$cond: [{ $gt: ["$resetTime", now] }, "$resetTime", now + windowMs],
					},
					count: {
						$cond: [
							{ $gt: ["$resetTime", now] },
							{ $add: [{ $ifNull: ["$count", 0] }, 1] },
							1,
						],
					},
				},
			},
		],
		{ returnDocument: "after" },
	);

	if (!record) {
		try {
			await collection.insertOne({
				ip: identifier,
				count: 1,
				resetTime: now + windowMs,
			});
		} catch (_err) {
			await checkRateLimit(req, { limit, windowMs, key });
		}
		return;
	}

	if (record.count > limit) {
		throw "RATE_LIMIT_EXCEEDED";
	}
}
