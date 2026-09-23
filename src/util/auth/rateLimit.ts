import { getTrustedClientIp } from "@util/auth/requestSecurity";
import { getCollection } from "@util/storage/mongo";

export async function checkRateLimit(
	req: Request | Record<string, unknown> = {},
	{
		limit = 5,
		windowMs = 60 * 1000,
		key,
	}: { limit?: number; windowMs?: number; key?: string } = {},
) {
	let identifier;
	if (key) {
		identifier = String(key);
	} else {
		identifier = getTrustedClientIp(req);
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
		} catch (err: any) {
			if (
				!(err instanceof Error) ||
				(err as Error & { code?: number }).code !== 11000
			)
				throw err;
			await checkRateLimit(req, { limit, windowMs, key });
		}
		return;
	}

	if (record.count > limit) {
		throw "RATE_LIMIT_EXCEEDED";
	}
}
