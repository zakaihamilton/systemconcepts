import { checkRateLimit } from "@util/auth/rateLimit";
import { findRecord } from "@util/storage/mongo";
import crypto from "crypto";
import { NextResponse } from "next/server";
import { JSON_HEADERS } from "./httpHeaders";

export { JSON_HEADERS, NO_CACHE_HEADERS } from "./httpHeaders";

export function jsonError(message, status = 500, headers = {}) {
	return NextResponse.json(
		{ err: message },
		{ status, headers: { ...JSON_HEADERS, ...headers } },
	);
}

export function jsonSuccess(data, status = 200, headers = {}) {
	return NextResponse.json(data, {
		status,
		headers: { ...JSON_HEADERS, ...headers },
	});
}

export function getClientIp(request) {
	const forwarded = request.headers.get("x-forwarded-for");
	if (forwarded) return forwarded.split(",")[0].trim();
	return request.headers.get("x-real-ip") || "unknown";
}

export async function enforceRateLimit(request, options) {
	try {
		await checkRateLimit({ ip: getClientIp(request) }, options);
		return null;
	} catch (err) {
		if (err === "RATE_LIMIT_EXCEEDED") {
			return jsonError("Too many requests. Please try again later.", 429);
		}
		throw err;
	}
}

export function timingSafeEqual(a, b) {
	if (typeof a !== "string" || typeof b !== "string") return false;
	const aBuffer = Buffer.from(a);
	const bBuffer = Buffer.from(b);
	if (aBuffer.length !== bBuffer.length) return false;
	return crypto.timingSafeEqual(aBuffer, bBuffer);
}

export function getApiToken(user) {
	return crypto
		.createHash("sha256")
		.update(
			user.id + user.hash + (process.env.RSS_SECRET || process.env.AWS_SECRET),
		)
		.digest("hex");
}

const authCache = new Map();
const AUTH_CACHE_TTL_MS = 60 * 1000;

export function __clearAuthCacheForTests() {
	authCache.clear();
}

export async function authenticateTokenRequest(searchParams) {
	const id = searchParams.get("id");
	const token = searchParams.get("token");
	if (!id || !token) return null;

	const cacheKey = `${id.toLowerCase()}:${token}`;
	const now = Date.now();
	const cached = authCache.get(cacheKey);
	if (cached && cached.expiresAt > now) return cached.user;

	const user = await findRecord({
		collectionName: "users",
		query: { id: id.toLowerCase() },
		fields: { id: 1, hash: 1, role: 1 },
	});
	const authenticated =
		user && user.role !== "visitor" && timingSafeEqual(token, getApiToken(user))
			? user
			: null;

	authCache.set(cacheKey, {
		user: authenticated,
		expiresAt: now + AUTH_CACHE_TTL_MS,
	});
	return authenticated;
}

export function getPositiveInt(value, fallback, max) {
	const parsed = Number.parseInt(value || "", 10);
	const safe = Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
	return Math.min(safe, max);
}

export function getNonNegativeInt(value, fallback = 0) {
	const parsed = Number.parseInt(value || "", 10);
	return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}
