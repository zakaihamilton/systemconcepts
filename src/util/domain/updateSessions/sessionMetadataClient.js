import { addSyncLog } from "@sync/sync";
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
	return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
}

function logMetadata(group, year, message, level = "info") {
	addSyncLog(`[${group}/${year}] ${message}`, level);
	if (level === "warning" || level === "error") {
		structuredLogger.warn(`[SessionMetadata] ${group}/${year}: ${message}`);
	} else {
		structuredLogger.info(`[SessionMetadata] ${group}/${year}: ${message}`);
	}
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

async function fetchTextFromUrl(url, label, group, year) {
	if (!url) {
		logMetadata(group, year, `Skip ${label} (no URL)`);
		return null;
	}
	const started = Date.now();
	logMetadata(group, year, `Fetching ${label}…`);
	const response = await withTimeout(
		fetch(url, { method: "GET" }),
		METADATA_FETCH_TIMEOUT_MS,
		`Timed out fetching metadata text (${label})`,
	);
	if (response.status === 404) {
		logMetadata(
			group,
			year,
			`${label} not found (404) (${Date.now() - started}ms)`,
		);
		return null;
	}
	if (!response.ok) {
		throw new Error(`Failed to fetch metadata (${label}: ${response.status})`);
	}
	// Body reads can stall after headers; bound them separately.
	const text = await withTimeout(
		response.text(),
		METADATA_FETCH_TIMEOUT_MS,
		`Timed out reading metadata text body (${label})`,
	);
	logMetadata(
		group,
		year,
		`Fetched ${label} (${text?.length || 0} chars, ${Date.now() - started}ms)`,
	);
	return text;
}

async function fetchBinaryFromUrl(url, label, group, year) {
	if (!url) {
		logMetadata(group, year, `Skip ${label} (no URL)`);
		return null;
	}
	const started = Date.now();
	logMetadata(group, year, `Fetching ${label}…`);
	const response = await withTimeout(
		fetch(url, { method: "GET" }),
		METADATA_FETCH_TIMEOUT_MS,
		`Timed out fetching metadata binary (${label})`,
	);
	if (response.status === 404) {
		logMetadata(
			group,
			year,
			`${label} not found (404) (${Date.now() - started}ms)`,
		);
		return null;
	}
	if (!response.ok) {
		throw new Error(
			`Failed to fetch metadata binary (${label}: ${response.status})`,
		);
	}
	const buffer = await withTimeout(
		response.arrayBuffer(),
		METADATA_FETCH_TIMEOUT_MS,
		`Timed out reading metadata binary body (${label})`,
	);
	logMetadata(
		group,
		year,
		`Fetched ${label} (${buffer?.byteLength || 0} bytes, ${Date.now() - started}ms)`,
	);
	return buffer;
}

async function fetchSessionMetadataViaPresign(group, year) {
	const started = Date.now();
	logMetadata(group, year, "Requesting presigned metadata URLs…");
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
	logMetadata(
		group,
		year,
		`Got presigned URLs (${Date.now() - started}ms); downloading sources…`,
	);

	const urls = payload?.urls || {};
	const [
		tagsContent,
		durationsContent,
		summariesContent,
		transcriptionsBuffer,
	] = await Promise.all([
		fetchTextFromUrl(urls.tags, "tags", group, year),
		fetchTextFromUrl(urls.duration, "durations", group, year),
		fetchTextFromUrl(urls.md, "summaries", group, year),
		fetchBinaryFromUrl(urls.zip, "transcriptions.zip", group, year),
	]);

	logMetadata(group, year, "Aggregating metadata sources…");
	const aggregated = aggregateSessionMetadataFromSources({
		group,
		year,
		items: payload?.items || [],
		tagsContent,
		durationsContent,
		summariesContent,
		transcriptionsBuffer,
	});
	logMetadata(
		group,
		year,
		`Presign metadata ready (${Date.now() - started}ms)`,
	);
	return aggregated;
}

async function fetchSessionMetadataViaProxy(group, year) {
	const started = Date.now();
	logMetadata(group, year, "Fetching metadata via session-metadata API…");
	const params = new URLSearchParams({
		group,
		year: String(year),
	});
	const result = await withTimeout(
		fetchJSON(`/api/session-metadata?${params.toString()}`, {
			method: "GET",
			cache: "no-store",
		}),
		METADATA_FETCH_TIMEOUT_MS,
		`Timed out fetching session metadata for ${group}/${year}`,
	);
	logMetadata(
		group,
		year,
		`Proxy metadata ready (${Date.now() - started}ms)`,
	);
	return result;
}

async function loadSessionMetadata(group, year) {
	try {
		return await withTimeout(
			fetchSessionMetadataViaPresign(group, year),
			METADATA_FETCH_TIMEOUT_MS * 2,
			`Timed out loading session metadata for ${group}/${year}`,
		);
	} catch (presignErr) {
		logMetadata(
			group,
			year,
			`Presigned fetch failed (${presignErr?.message || presignErr}); falling back to proxy`,
			"warning",
		);
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
			logMetadata(group, year, "Using in-memory metadata cache");
			return cached.value;
		}
		if (pendingRequests.has(cacheKey)) {
			logMetadata(group, year, "Joining in-flight metadata request");
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
		logMetadata(
			group,
			year,
			`Metadata load failed: ${err?.message || err}`,
			"error",
		);
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
