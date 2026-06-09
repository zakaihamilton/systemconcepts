import { fetchJSON } from "@util/api/fetch";
import { aggregateSessionMetadataFromSources } from "./metadataAggregator";

const SESSION_METADATA_CACHE_TTL_MS = 5 * 60 * 1000;
const metadataCache = new Map();

function getCacheKey(group, year, metadataFingerprint) {
	return `${group}/${year}/${metadataFingerprint || "unknown"}`;
}

export function clearSessionMetadataCache() {
	metadataCache.clear();
}

export function seedSessionMetadataCache(group, year, metadataFingerprint, value) {
	const cacheKey = getCacheKey(group, year, metadataFingerprint);
	metadataCache.set(cacheKey, {
		value,
		expiresAt: Date.now() + SESSION_METADATA_CACHE_TTL_MS,
	});
}

async function fetchTextFromUrl(url) {
	if (!url) return null;
	const response = await fetch(url, { method: "GET" });
	if (response.status === 404) return null;
	if (!response.ok) {
		throw new Error(`Failed to fetch metadata (${response.status})`);
	}
	return await response.text();
}

async function fetchBinaryFromUrl(url) {
	if (!url) return null;
	const response = await fetch(url, { method: "GET" });
	if (response.status === 404) return null;
	if (!response.ok) {
		throw new Error(`Failed to fetch metadata binary (${response.status})`);
	}
	return await response.arrayBuffer();
}

async function fetchSessionMetadataViaPresign(group, year) {
	const params = new URLSearchParams({
		group,
		year: String(year),
	});
	const payload = await fetchJSON(`/api/aws_download?${params.toString()}`, {
		method: "GET",
		cache: "no-store",
	});
	if (payload?.err) {
		throw new Error(payload.err);
	}

	const urls = payload?.urls || {};
	const [tagsContent, durationsContent, summariesContent, transcriptionsBuffer] =
		await Promise.all([
			fetchTextFromUrl(urls.tags),
			fetchTextFromUrl(urls.duration),
			fetchTextFromUrl(urls.md),
			fetchBinaryFromUrl(urls.zip),
		]);

	return aggregateSessionMetadataFromSources({
		group,
		year,
		items: payload?.items || [],
		tagsContent,
		durationsContent,
		summariesContent,
		transcriptionsBuffer,
	});
}

async function fetchSessionMetadataViaProxy(group, year) {
	const params = new URLSearchParams({
		group,
		year: String(year),
	});
	return await fetchJSON(`/api/session-metadata?${params.toString()}`, {
		method: "GET",
		cache: "no-store",
	});
}

export async function fetchSessionMetadata(
	group,
	year,
	metadataFingerprint,
	forceUpdate = false,
) {
	const cacheKey = getCacheKey(group, year, metadataFingerprint);
	if (!forceUpdate) {
		const cached = metadataCache.get(cacheKey);
		if (cached && cached.expiresAt > Date.now()) {
			return cached.value;
		}
	}

	let value;
	try {
		value = await fetchSessionMetadataViaPresign(group, year);
	} catch (presignErr) {
		console.warn(
			`[SessionMetadata] Presigned fetch failed for ${group}/${year}; falling back to session-metadata API`,
			presignErr,
		);
		value = await fetchSessionMetadataViaProxy(group, year);
	}

	metadataCache.set(cacheKey, {
		value,
		expiresAt: Date.now() + SESSION_METADATA_CACHE_TTL_MS,
	});
	return value;
}
