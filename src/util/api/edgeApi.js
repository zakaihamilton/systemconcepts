import { logger as structuredLogger } from "@util/api/logger";

function getSiteUrl() {
	return (
		process.env.SITE_URL ||
		process.env.NEXT_PUBLIC_SITE_URL ||
		"https://systemconcepts.app"
	);
}

export async function authenticateEdge(searchParams) {
	const id = searchParams.get("id");
	const token = searchParams.get("token");
	if (!id || !token) return false;

	const siteUrl = getSiteUrl();
	try {
		const res = await fetch(`${siteUrl}/api/rss/verify`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"x-internal-key": process.env.AWS_SECRET || "",
			},
			body: JSON.stringify({ id, token }),
		});
		if (!res.ok) {
			structuredLogger.warn("[Edge API] Verify endpoint returned", res.status);
			return false;
		}
		const { ok } = await res.json();
		return ok === true;
	} catch (err) {
		structuredLogger.error("[Edge API] Auth fetch failed:", err);
		return false;
	}
}

const rateLimitCache = new Map();
const RATE_LIMIT_CACHE_TTL_MS = 5 * 1000;

export async function enforceRateLimitEdge(ip, options = {}) {
	const { limit = 60, windowMs = 60 * 1000 } = options;
	if (!ip) return false;

	const now = Date.now();
	const cached = rateLimitCache.get(ip);
	if (cached && cached.expiresAt > now) return cached.ok;

	const siteUrl = getSiteUrl();
	try {
		const res = await fetch(`${siteUrl}/api/internal/rate-limit`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"x-internal-key": process.env.AWS_SECRET || "",
			},
			body: JSON.stringify({ ip, limit, windowMs }),
		});
		if (!res.ok) {
			structuredLogger.warn(
				"[Edge API] Rate limit endpoint returned",
				res.status,
			);
			return false;
		}
		const { ok } = await res.json();
		rateLimitCache.set(ip, {
			ok: ok === true,
			expiresAt: now + RATE_LIMIT_CACHE_TTL_MS,
		});
		return ok === true;
	} catch (err) {
		structuredLogger.error("[Edge API] Rate limit fetch failed:", err);
		return true;
	}
}

export function scheduleApiCacheWrite(type, key, body) {
	const siteUrl = getSiteUrl();
	void fetch(`${siteUrl}/api/internal/api-cache`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"x-internal-key": process.env.AWS_SECRET || "",
		},
		body: JSON.stringify({ type, key, body }),
	}).catch((err) => {
		structuredLogger.error(
			"[Edge API] Failed to schedule api-cache write:",
			err,
		);
	});
}

export function __clearEdgeApiCachesForTests() {
	rateLimitCache.clear();
}

export function getClientIp(request) {
	const forwarded = request.headers.get("x-forwarded-for");
	if (forwarded) return forwarded.split(",")[0].trim();
	return request.headers.get("x-real-ip") || "unknown";
}
