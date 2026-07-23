import { fetchJSON } from "@util/api/fetch";
import { logger as structuredLogger } from "@util/api/logger";
import { aggregateSessionMetadataFromSources } from "./metadataAggregator";

const SESSION_METADATA_CACHE_TTL_MS = 5 * 60 * 1000;
const METADATA_FETCH_TIMEOUT_MS = 60 * 1000;
const metadataCache = new Map();
const pendingRequests = new Map();

function getCacheKey(group, year, metadataFingerprint) {
	return `${group}/${year}/${metadataFingerprint || "unknown"}`;
}

function withTimeout(promise, ms, message) {
	let timeoutId;
	const timeout = new Promise((_, reject) => {
		timeoutId = setTimeout(() => reject(new Error(message)), ms);
	});
	return Promise.race([promise, timeout]).finally(() =>
		clearTimeout(timeoutId),
	);
}

export function clearSessionMetadataCache() {
	metadataCache.clear();
	pendingRequests.clear();
}

export function seedSessionMetadataCache(
	group,
	year,
	metadataFingerprint,
	value,
) {
	const cacheKey = getCacheKey(group, year, metadataFingerprint);
	metadataCache.set(cacheKey, {
		value,
		expiresAt: Date.now() + SESSION_METADATA_CACHE_TTL_MS,
	});
}

async function fetchTextFromUrl(url) {
	if (!url) return null;
	const response = await withTimeout(
		fetch(url, { method: "GET" }),
		METADATA_FETCH_TIMEOUT_MS,
		`Timed out fetching metadata text`,
	);
	if (response.status === 404) return null;
	if (!response.ok) {
		throw new Error(`Failed to fetch metadata (${response.status})`);
	}
	// Body reads can stall after headers; bound them separately.
	return await withTimeout(
		response.text(),
		METADATA_FETCH_TIMEOUT_MS,
		`Timed out reading metadata text body`,
	);
}

async function fetchBinaryFromUrl(url) {
	if (!url) return null;
	const response = await withTimeout(
		fetch(url, { method: "GET" }),
		METADATA_FETCH_TIMEOUT_MS,
		`Timed out fetching metadata binary`,
	);
	if (response.status === 404) return null;
	if (!response.ok) {
		throw new Error(`Failed to fetch metadata binary (${response.status})`);
	}
	return await withTimeout(
		response.arrayBuffer(),
		METADATA_FETCH_TIMEOUT_MS,
		`Timed out reading metadata binary body`,
	);
}

async function fetchSessionMetadataViaPresign(group, year) {
	const params = new URLSearchParams({
		group,
		year: String(year),
	});
	const payload = await withTimeout(
		fetchJSON(`/api/aws_download?${params.toString()}`, {
			method: "GET",
			cache: "no-store",
		}),
		METADATA_FETCH_TIMEOUT_MS,
		`Timed out requesting metadata URLs for ${group}/${year}`,
	);
	if (payload?.err) {
		throw new Error(payload.err);
	}

	const urls = payload?.urls || {};
	const [
		tagsContent,
		durationsContent,
		summariesContent,
		transcriptionsBuffer,
	] = await Promise.all([
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
	return await withTimeout(
		fetchJSON(`/api/session-metadata?${params.toString()}`, {
			method: "GET",
			cache: "no-store",
		}),
		METADATA_FETCH_TIMEOUT_MS,
		`Timed out fetching session metadata for ${group}/${year}`,
	);
}

async function loadSessionMetadata(group, year) {
	try {
		return await withTimeout(
			fetchSessionMetadataViaPresign(group, year),
			METADATA_FETCH_TIMEOUT_MS * 2,
			`Timed out loading session metadata for ${group}/${year}`,
		);
	} catch (presignErr) {
		structuredLogger.warn(
			`[SessionMetadata] Presigned fetch failed for ${group}/${year}; falling back to session-metadata API`,
			presignErr,
		);
		return await fetchSessionMetadataViaProxy(group, year);
	}
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
		if (pendingRequests.has(cacheKey)) {
			return pendingRequests.get(cacheKey);
		}
	}

	const promise = loadSessionMetadata(group, year);
	if (!forceUpdate) {
		pendingRequests.set(cacheKey, promise);
	}

	try {
		const value = await promise;
		metadataCache.set(cacheKey, {
			value,
			expiresAt: Date.now() + SESSION_METADATA_CACHE_TTL_MS,
		});
		return value;
	} catch (err) {
		if (!forceUpdate) {
			pendingRequests.delete(cacheKey);
		}
		throw err;
	} finally {
		if (!forceUpdate && pendingRequests.get(cacheKey) === promise) {
			pendingRequests.delete(cacheKey);
		}
	}
}
