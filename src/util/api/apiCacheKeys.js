export const API_CACHE_PREFIX = "api-cache";

const CACHE_EXTENSIONS = {
	sessions: "json.gz",
	rss: "xml.gz",
};

const AUTH_PARAMS = new Set(["id", "token"]);

function getPositiveInt(value, fallback, max) {
	const parsed = Number.parseInt(value || "", 10);
	const safe = Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
	return Math.min(safe, max);
}

function getNonNegativeInt(value, fallback = 0) {
	const parsed = Number.parseInt(value || "", 10);
	return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export function getCacheObjectPath(type, key) {
	const extension = CACHE_EXTENSIONS[type];
	if (!extension) {
		throw new Error(`Unknown API cache type: ${type}`);
	}
	return `${API_CACHE_PREFIX}/${type}/${key}.${extension}`;
}

function matchesGroup(filePath, group) {
	if (!group) return true;
	const lowerGroup = group.toLowerCase().trim();
	const lowerPath = filePath.toLowerCase();
	return (
		filePath === "/bundle.json" ||
		lowerPath === `/${lowerGroup}.json` ||
		lowerPath.startsWith(`/${lowerGroup}/`)
	);
}

export function getManifestFingerprint(manifest, { group } = {}) {
	const entries = (manifest || [])
		.filter(
			(file) =>
				file.path &&
				file.path.endsWith(".json") &&
				file.path !== "/files.json" &&
				matchesGroup(file.path, group),
		)
		.map((file) => ({
			path: file.path,
			version: String(file.version || "0"),
		}))
		.sort((a, b) => a.path.localeCompare(b.path));

	return entries.map((entry) => `${entry.path}:${entry.version}`).join("|");
}

export function getContentParams(type, searchParams) {
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
			count: getPositiveInt(searchParams.get("count"), 250, 500),
		};
	}

	throw new Error(`Unknown API cache type: ${type}`);
}

export async function buildApiCacheKey(type, contentParams, fingerprint) {
	const material = JSON.stringify({ type, contentParams, fingerprint });
	const hashBuffer = await crypto.subtle.digest(
		"SHA-256",
		new TextEncoder().encode(material),
	);
	return Array.from(new Uint8Array(hashBuffer))
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}

export function buildCanonicalApiUrl(baseUrl, pathname, searchParams) {
	const url = new URL(pathname, baseUrl);
	for (const [name, value] of searchParams.entries()) {
		if (!AUTH_PARAMS.has(name)) {
			url.searchParams.append(name, value);
		}
	}
	return url.toString();
}
