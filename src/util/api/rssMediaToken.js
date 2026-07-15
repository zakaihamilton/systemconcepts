// Podcast clients keep an episode's enclosure URL and may not re-fetch the
// feed before playing it again. Keep the capability valid for the life of a
// normal podcast subscription; the media proxy still issues short-lived S3
// redirects for each request.
const TOKEN_TTL_SECONDS = 365 * 24 * 60 * 60;

function encode(value) {
	return new TextEncoder().encode(value);
}

function base64url(bytes) {
	const binary = Array.from(new Uint8Array(bytes), (byte) =>
		String.fromCharCode(byte),
	).join("");
	return btoa(binary)
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/, "");
}

function encodePath(path) {
	return base64url(encode(path));
}

function timingSafeEqual(left, right) {
	if (left.length !== right.length) return false;
	let result = 0;
	for (let index = 0; index < left.length; index += 1) {
		result |= left.charCodeAt(index) ^ right.charCodeAt(index);
	}
	return result === 0;
}

function getSecret() {
	const secret = process.env.RSS_MEDIA_SECRET;
	if (secret) return secret;
	if (process.env.NODE_ENV !== "production")
		return "development-rss-media-secret";
	throw new Error("RSS_MEDIA_SECRET_NOT_CONFIGURED");
}

async function sign(payload) {
	const key = await crypto.subtle.importKey(
		"raw",
		encode(getSecret()),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	return base64url(await crypto.subtle.sign("HMAC", key, encode(payload)));
}

function payload({ route, resource, expiresAt }) {
	return `v1\n${route}\n${resource}\n${expiresAt}`;
}

export function isPublicRssMediaPath(path) {
	if (!path || typeof path !== "string" || path.includes("\0")) return false;
	const normalized = path.replace(/^\//, "");
	if (normalized.split("/").includes("..")) return false;
	return normalized.startsWith("sessions/") || normalized.startsWith("wasabi/");
}

// Feeds cached before RSS media capabilities were introduced contain no
// `exp`/`sig` parameters. Those URLs were already limited to public session
// paths by the proxy, so accept only that exact legacy shape while old feed
// and client caches drain. A partially supplied or invalid capability remains
// denied.
export function isLegacyRssMediaRequest({ expiresAt, signature }) {
	return expiresAt === null && signature === null;
}

export async function createRssMediaToken({
	route,
	resource,
	now = Date.now(),
}) {
	if (!isPublicRssMediaPath(resource)) throw new Error("INVALID_MEDIA_PATH");
	const expiresAt = Math.floor(now / 1000) + TOKEN_TTL_SECONDS;
	return {
		expiresAt,
		signature: await sign(payload({ route, resource, expiresAt })),
	};
}

export async function verifyRssMediaToken({
	route,
	resource,
	expiresAt,
	signature,
	now = Date.now(),
}) {
	if (!isPublicRssMediaPath(resource)) return false;
	const expiry = Number.parseInt(expiresAt, 10);
	if (!Number.isSafeInteger(expiry) || expiry <= Math.floor(now / 1000))
		return false;
	if (!signature || !/^[A-Za-z0-9_-]{32,}$/.test(signature)) return false;
	const expected = await sign(payload({ route, resource, expiresAt: expiry }));
	return timingSafeEqual(expected, signature);
}

export async function createRssMediaUrl({ baseUrl, route, path, extension }) {
	const resource = path.replace(/^\//, "");
	const { expiresAt, signature } = await createRssMediaToken({
		route,
		resource,
	});
	const params = new URLSearchParams({
		p: encodePath(resource),
		exp: String(expiresAt),
		sig: signature,
	});
	if (extension) params.set("e", extension);
	return `${baseUrl}/api/rss/${route === "media" ? "s" : "transcription"}?${params}`;
}

export const RSS_MEDIA_TOKEN_TTL_SECONDS = TOKEN_TTL_SECONDS;
