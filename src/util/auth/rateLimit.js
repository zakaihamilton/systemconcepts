import { getCollection } from "@util/storage/mongo";

export async function checkRateLimit(
	req = {},
	{ limit = 5, windowMs = 60 * 1000 } = {},
) {
	const headers = req.headers || {};
	const forwarded =
		req.ip ||
		(typeof headers.get === "function"
			? headers.get("x-forwarded-for")
			: headers["x-forwarded-for"]);
	const remoteAddress = req.socket?.remoteAddress || "unknown";
	const ip = forwarded ? String(forwarded).split(",")[0].trim() : remoteAddress;

	if (!ip) {
		console.warn("Could not determine IP for rate limiting");
		return;
	}

	const collectionName = "rate_limits";
	const now = Date.now();
	const collection = await getCollection({ collectionName });

	const record = await collection.findOneAndUpdate(
		{ ip },
		[
			{
				$set: {
					ip,
					resetTime: {
						$cond: [
							{ $gt: ["$resetTime", now] },
							"$resetTime",
							now + windowMs,
						],
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
			await collection.insertOne({ ip, count: 1, resetTime: now + windowMs });
		} catch (_err) {
			await checkRateLimit(req, { limit, windowMs });
		}
		return;
	}

	if (record.count > limit) {
		throw "RATE_LIMIT_EXCEEDED";
	}
}
