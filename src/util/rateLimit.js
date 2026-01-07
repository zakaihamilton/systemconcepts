import { getCollection } from "./mongo";

export async function checkRateLimit(req, { limit = 5, windowMs = 60 * 1000 } = {}) {
    // Only rate limit in production/staging environments
    // But for this task, we enable it always.

    // Get IP address (parse first IP from x-forwarded-for to avoid spoofing via extra values)
    const forwarded = req.headers["x-forwarded-for"];
    const ip = forwarded ? forwarded.split(',')[0].trim() : req.socket.remoteAddress;

    if (!ip) {
        // Fallback or ignore if IP cannot be determined (unlikely in HTTP)
        console.warn("Could not determine IP for rate limiting");
        return;
    }

    const collectionName = "rate_limits";
    const now = Date.now();
    const collection = await getCollection({ collectionName });

    // Atomic update: increment count, set resetTime if missing or expired
    // We can't easily do "if expired then reset count" in a single atomic operation without pipeline updates (Mongo 4.2+).
    // Assuming Mongo 4.2+ is available (likely), we can use an aggregation pipeline in update.
    // However, simpler approach:

    // 1. Try to increment where resetTime > now
    const result = await collection.findOneAndUpdate(
        { ip, resetTime: { $gt: now } },
        { $inc: { count: 1 } },
        { returnDocument: "after" }
    );

    let record = result; // In driver v6, findOneAndUpdate returns the document directly if includeResultMetadata is false (default depends on options)
    // Actually, in v6 it returns the document by default or null.

    // If no document matched (either new IP or expired), we need to reset/insert.
    if (!record) {
        // Upsert a new window
        const newRecord = {
            ip,
            count: 1,
            resetTime: now + windowMs
        };
        // Use updateOne with upsert to handle race where another request just created it.
        // If it exists now (race condition), we just want to reset it?
        // No, if it exists now, it means someone else beat us.
        // Let's just use updateOne with upsert.

        // We want to set count=1 and resetTime=now+windowMs IF it doesn't exist OR it's expired.
        // The previous findOneAndUpdate failed, so either it doesn't exist or resetTime <= now.

        await collection.updateOne(
            { ip },
            {
                $set: { count: 1, resetTime: now + windowMs },
                $setOnInsert: { ip }
            },
            { upsert: true }
        );
        // We assume count is 1. If we overwrote a just-active record, we reset their limit. Acceptable.
        record = { count: 1 };
    }

    if (record.count > limit) {
        throw "RATE_LIMIT_EXCEEDED";
    }
}
