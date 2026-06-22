import { checkRateLimit } from "@util/auth/rateLimit";
import { findRecord } from "@util/storage/mongo";
import crypto from "crypto";
import { NextResponse } from "next/server";

export const JSON_HEADERS = {
	"Content-Type": "application/json; charset=utf-8",
};

export const NO_CACHE_HEADERS = {
	"Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
	Pragma: "no-cache",
	Expires: "0",
};

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

export async function authenticateTokenRequest(searchParams) {
	const id = searchParams.get("id");
	const token = searchParams.get("token");
	if (!id || !token) return null;

	const user = await findRecord({
		collectionName: "users",
		query: { id: id.toLowerCase() },
		fields: { id: 1, hash: 1, role: 1 },
	});
	if (!user || user.role === "visitor") return null;
	return timingSafeEqual(token, getApiToken(user)) ? user : null;
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
