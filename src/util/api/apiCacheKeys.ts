export const API_CACHE_PREFIX = "api-cache";

const CACHE_EXTENSIONS: Record<string, string> = {
	sessions: "json.gz",
	rss: "xml.gz",
};

// Bump this when the generated RSS document changes in a way that makes a
// previously stored document unusable (for example, enclosure URL format).
const CACHE_CONTENT_VERSIONS: Record<string, string> = {
	// Force regeneration after the sessions serializer started awaiting its
	// signed media URLs. Older cached responses contain serialized Promises
	// (`{}`) instead of URL strings or null.
	sessions: "media-url-v2",
	// Force regeneration after media capabilities became mandatory. Cached v3
	// documents may still contain legacy unsigned enclosure URLs, which the
	// media proxy correctly rejects.
	rss: "media-url-v4",
};

const AUTH_PARAMS = new Set(["id", "token"]);

function getPositiveInt(value: any, fallback: any, max: any) {
	const parsed = Number.parseInt(value || "", 10);
	const safe = Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
	return Math.min(safe, max);
}

function getNonNegativeInt(value: any, fallback = 0) {
	const parsed = Number.parseInt(value || "", 10);
	return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export function getCacheObjectPath(type: any, key: any) {
	const extension = CACHE_EXTENSIONS[type];
	if (!extension) {
		throw new Error(`Unknown API cache type: ${type}`);
	}
	return `${API_CACHE_PREFIX}/${type}/${key}.${extension}`;
}

function matchesGroup(filePath: any, group: any) {
	if (!group) return true;
	const lowerGroup = group.toLowerCase().trim();
	const lowerPath = filePath.toLowerCase();
	return (
		filePath === "/bundle.json" ||
		lowerPath === `/${lowerGroup}.json` ||
		lowerPath.startsWith(`/${lowerGroup}/`)
	);
}

export function getManifestFingerprint(manifest: any, { group }: any = {}) {
	const entries = (manifest || [])
		.filter(
			(file: any) =>
				file.path &&
				file.path.endsWith(".json") &&
				file.path !== "/files.json" &&
				matchesGroup(file.path, group),
		)
		.map((file: any) => ({
			path: file.path,
			version: String(file.version || "0"),
		}))
		.sort((a: any, b: any) => a.path.localeCompare(b.path));

	return entries
		.map((entry: any) => `${entry.path}:${entry.version}`)
		.join("|");
}

export function getContentParams(type: any, searchParams: any) {
	if (type === "sessions") {
		return {
			group: searchParams.get("group") || "",
			tag: searchParams.get("tag") || "",
			date: searchParams.get("date") || "",
			year: searchParams.get("year") || "",
			query: searchParams.get("query") || "",
			index: getNonNegativeInt(searchParams.get("index")),
			count: getPositiveInt(searchParams.get("count"), 100, 500),
		};
	}

	if (type === "rss") {
		return {
			group: searchParams.get("group") || "",
			count: getPositiveInt(searchParams.get("count"), 50, 500),
		};
	}

	throw new Error(`Unknown API cache type: ${type}`);
}

export async function buildApiCacheKey(
	type: any,
	contentParams: any,
	fingerprint: any,
) {
	const material = JSON.stringify({
		type,
		contentParams,
		fingerprint,
		contentVersion: CACHE_CONTENT_VERSIONS[type] || "v1",
	});
	const hashBuffer = await crypto.subtle.digest(
		"SHA-256",
		new TextEncoder().encode(material),
	);
	return Array.from(new Uint8Array(hashBuffer))
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}

export function buildCanonicalApiUrl(
	baseUrl: any,
	pathname: any,
	searchParams: any,
) {
	const url = new URL(pathname, baseUrl);
	for (const [name, value] of searchParams.entries()) {
		if (!AUTH_PARAMS.has(name)) {
			url.searchParams.append(name, value);
		}
	}
	return url.toString();
}
