import { fetchJSON } from "@util/fetch";

const SESSION_METADATA_CACHE_TTL_MS = 5 * 60 * 1000;
const metadataCache = new Map();

function getCacheKey(group, year, metadataFingerprint) {
	return `${group}/${year}/${metadataFingerprint || "unknown"}`;
}

export function clearSessionMetadataCache() {
	metadataCache.clear();
}

export async function fetchSessionMetadata(group, year, metadataFingerprint) {
	const cacheKey = getCacheKey(group, year, metadataFingerprint);
	const cached = metadataCache.get(cacheKey);
	if (cached && cached.expiresAt > Date.now()) {
		return cached.value;
	}

	const params = new URLSearchParams({
		group,
		year: String(year),
	});
	const value = await fetchJSON(`/api/session-metadata?${params.toString()}`, {
		method: "GET",
		cache: "no-store",
	});
	metadataCache.set(cacheKey, {
		value,
		expiresAt: Date.now() + SESSION_METADATA_CACHE_TTL_MS,
	});
	return value;
}
