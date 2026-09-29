import { LOCAL_SYNC_PATH } from "@sync/constants";
import { logger as structuredLogger } from "@util/api/logger";
import { fileFolder, makePath } from "@util/data/path";
import storage from "@util/storage/storage";
import {
	getMetadataFileFingerprint,
	normalizeMetadataPayload,
	serializeMetadataFingerprint,
} from "./fingerprints";
import {
	loadDurations,
	loadSummaries,
	loadTags,
	loadTranscriptions,
} from "./metadata";
import { fetchSessionMetadata } from "./sessionMetadataClient";
import { getListing, yieldToMain } from "./utils";

const GROUP_UPDATE_CACHE_PATH = makePath(
	fileFolder(LOCAL_SYNC_PATH),
	".group-update-cache",
);

export async function getGroupMetadataFiles(groupName: any) {
	const metadataPath = makePath("aws/sessions", groupName);
	const metadataFiles = new Map<any, any>();
	try {
		const metadataItems = await getListing(metadataPath);
		for (const item of metadataItems || []) {
			metadataFiles.set(item.name, item);
		}
	} catch (err: any) {
		structuredLogger.warn(
			`[UpdateGroup] Failed to list metadata for ${groupName}`,
			err,
		);
	}
	return metadataFiles;
}

export function getMetadataFingerprint(metadataFiles: any, yearName: any) {
	return [".tags", ".duration", ".md", ".zip"].map((extension) =>
		getMetadataFileFingerprint(metadataFiles.get(`${yearName}${extension}`)),
	);
}

export function getMetadataFromYearCache(
	yearCache: any,
	metadataFingerprint: any,
) {
	if (!yearCache?.metadata) {
		return null;
	}
	const fingerprintKey = serializeMetadataFingerprint(metadataFingerprint);
	if (yearCache.metadataFingerprint !== fingerprintKey) {
		return null;
	}
	return normalizeMetadataPayload(yearCache.metadata);
}

export function getYearCachePath(groupName: any, yearName: any) {
	return makePath(GROUP_UPDATE_CACHE_PATH, groupName, `${yearName}.json`);
}

export async function readYearCache(groupName: any, yearName: any) {
	try {
		const path = getYearCachePath(groupName, yearName);
		const content = await storage.readFile(path);
		return content ? JSON.parse(content) : null;
	} catch (err: any) {
		structuredLogger.warn(
			`[UpdateGroup] Failed to read year cache for ${groupName}/${yearName}`,
			err,
		);
		return null;
	}
}

export async function writeYearCache(
	groupName: any,
	yearName: any,
	fingerprint: any,
	metadataFingerprint: any,
	metadata: any,
	sessionFingerprints = null,
) {
	try {
		const path = getYearCachePath(groupName, yearName);
		await storage.createFolderPath(path);
		await yieldToMain();
		// Slim listing items — full aws/wasabi dir entries bloat the cache and
		// can hang IndexedDB writes after "Saving sessions…".
		const slimItems = (metadata?.items || []).map((item: any) => ({
			name: item.name,
			path: item.path,
			type: item.type || item.stat?.type,
		}));
		await storage.writeFile(
			path,
			JSON.stringify({
				fingerprint,
				metadataFingerprint: serializeMetadataFingerprint(metadataFingerprint),
				metadata: normalizeMetadataPayload({
					items: slimItems,
					tags: metadata?.tags,
					durations: metadata?.durations,
					// Omit summaries — they dominate cache size and hang IndexedDB writes.
					// Fresh metadata fetch / summary.path cover display needs.
					summaries: {},
					transcriptions: metadata?.transcriptions,
				}),
				sessionFingerprints: sessionFingerprints || {},
				updatedAt: Date.now(),
			}),
		);
	} catch (err: any) {
		structuredLogger.warn(
			`[UpdateGroup] Failed to write year cache for ${groupName}/${yearName}`,
			err,
		);
	}
}

export function getCachedSessionsForYear(existingSessions: any, yearName: any) {
	return (existingSessions || []).filter((session: any) => {
		const id = session.id || session.name || "";
		return (
			String(session.year || "").trim() === String(yearName) ||
			id.startsWith(yearName)
		);
	});
}

export function getSessionYear(session: any) {
	const explicitYear = String(session?.year || "").trim();
	if (/^\d{4}$/.test(explicitYear)) {
		return explicitYear;
	}
	const id = String(session?.id || session?.name || "");
	const match = id.match(/^(\d{4})/);
	return match?.[1] || null;
}

export function getSessionDate(id: any) {
	const match = String(id || "").match(/^(\d{4}-\d{2}-\d{2})(?:\s|$)/);
	return match?.[1] || null;
}

export function mergeSessionsById(existingSessions: any, updatedSessions: any) {
	const sessions = new Map<any, any>();
	for (const session of existingSessions || []) {
		sessions.set(session.id || session.name, session);
	}
	for (const session of updatedSessions || []) {
		sessions.set(session.id || session.name, session);
	}
	return Array.from(sessions.values()).sort((a, b) =>
		(a.id || a.name).localeCompare(b.id || b.name),
	);
}

export async function loadCachedYearSessions(
	groupName: any,
	yearName: any,
	isMerged: any,
	isBundled: any,
) {
	if (isMerged || isBundled) return [];
	const localYearPath = makePath(
		LOCAL_SYNC_PATH,
		groupName,
		`${yearName}.json`,
	);
	return readSessionsFile(localYearPath);
}

export async function getLegacyMetadata(
	year: any,
	name: any,
	awsPath: any,
	forceUpdate: any,
	isMerged: any,
	isBundled: any,
) {
	const metadataYearPath = makePath("aws/sessions", name, year.name);
	const metadataYearItems = await getMetadataYearItems(metadataYearPath);
	const [
		sessionTagsMap,
		sessionDurationMap,
		sessionSummariesMap,
		sessionTranscriptionMap,
	] = await Promise.all([
		loadTags(year, name, awsPath, forceUpdate, isMerged, isBundled),
		loadDurations(year, name, awsPath, forceUpdate, isMerged, isBundled),
		loadSummaries(year, name, awsPath, forceUpdate, isMerged, isBundled),
		loadTranscriptions(year, name, awsPath, forceUpdate, isMerged, isBundled),
	]);
	return {
		items: metadataYearItems,
		tags: sessionTagsMap,
		durations: sessionDurationMap,
		summaries: sessionSummariesMap,
		transcriptions: sessionTranscriptionMap,
	};
}

export async function getMetadataYearItems(metadataYearPath: any) {
	try {
		const items = await getListing(metadataYearPath);
		items.sort((a: any, b: any) => a.name.localeCompare(b.name));
		structuredLogger.debug(
			`[UpdateGroup] Metadata folder ${metadataYearPath} has ${items.length} items`,
		);
		return items;
	} catch (err: any) {
		structuredLogger.warn(
			`[UpdateGroup] Failed to list metadata folder ${metadataYearPath}`,
			err,
		);
		return [];
	}
}

export async function readSessionsFile(path: any) {
	try {
		if (!(await storage.exists(path))) {
			return [];
		}
		const content = await storage.readFile(path);
		const data = JSON.parse(content);
		return Array.isArray(data?.sessions) ? data.sessions : [];
	} catch (err: any) {
		structuredLogger.warn(
			`[UpdateGroup] Failed to read cached metadata ${path}`,
			err,
		);
		return [];
	}
}

export async function loadCachedYearMetadata(
	name: any,
	yearName: any,
	isMerged: any,
	isBundled: any,
) {
	let sessions = [];

	if (isBundled) {
		const bundlePath = makePath(LOCAL_SYNC_PATH, "bundle.json");
		sessions = (await readSessionsFile(bundlePath)).filter(
			(session: any) => session.group === name,
		);
	} else if (isMerged) {
		const mergedPath = makePath(LOCAL_SYNC_PATH, `${name}.json`);
		sessions = await readSessionsFile(mergedPath);
	} else {
		const localYearPath = makePath(LOCAL_SYNC_PATH, name, `${yearName}.json`);
		sessions = await readSessionsFile(localYearPath);
	}

	const yearSessions = sessions.filter((session: any) => {
		const id = session.id || session.name || "";
		return id.startsWith(yearName);
	});
	if (yearSessions.length === 0) {
		return null;
	}

	const metadata = {
		items: [],
		tags: Object.create(null),
		durations: Object.create(null),
		summaries: Object.create(null),
		transcriptions: Object.create(null),
	};

	for (const session of yearSessions) {
		const keys = [session.id, session.name].filter(Boolean);
		for (const key of keys) {
			if (Array.isArray(session.tags) && session.tags.length > 0) {
				metadata.tags[key] = session.tags;
			}
			if (session.duration) {
				metadata.durations[key] = session.duration;
			}
			if (session.summaryText) {
				metadata.summaries[key] = session.summaryText;
			}
			if (session.transcription) {
				metadata.transcriptions[key] = session.transcription;
			}
		}
	}

	return metadata;
}

export async function getYearMetadata(
	year: any,
	name: any,
	forceUpdate: any,
	isMerged: any,
	isBundled: any,
	metadataFingerprint: any,
) {
	const awsPath = makePath("aws/sessions", name);
	const yearCache = await readYearCache(name, year.name);
	const cachedFromYearCache = getMetadataFromYearCache(
		yearCache,
		metadataFingerprint,
	);
	// Manual metadata refreshes must bypass the persistent year cache. Otherwise
	// the UI reports a forced update while silently reusing stale metadata.
	if (cachedFromYearCache && !forceUpdate) {
		return cachedFromYearCache;
	}

	const fingerprintKey = serializeMetadataFingerprint(metadataFingerprint);
	const yearCacheFingerprintMatches =
		yearCache?.metadataFingerprint === fingerprintKey;

	if (!forceUpdate) {
		if (!yearCache || yearCacheFingerprintMatches) {
			const cached = await loadCachedYearMetadata(
				name,
				year.name,
				isMerged,
				isBundled,
			);
			if (cached) {
				return cached;
			}
		}
	}

	try {
		const metadata = await fetchSessionMetadata(
			name,
			year.name,
			metadataFingerprint,
			forceUpdate,
		);
		return normalizeMetadataPayload(metadata);
	} catch (err: any) {
		const timedOut = /timed out/i.test(String(err?.message || err));
		structuredLogger.warn(
			`[UpdateGroup] Aggregated metadata fetch failed for ${name}/${year.name}; ${
				timedOut
					? "skipping legacy fallback after timeout"
					: "falling back to legacy metadata reads"
			}`,
			err,
		);
		if (timedOut) {
			// Legacy reads (especially zip) have no timeouts and can hang forever
			// after a metadata timeout — prefer cached/empty metadata instead.
			const cached = await loadCachedYearMetadata(
				name,
				year.name,
				isMerged,
				isBundled,
			);
			return cached || normalizeMetadataPayload({});
		}
		return await getLegacyMetadata(
			year,
			name,
			awsPath,
			forceUpdate,
			isMerged,
			isBundled,
		);
	}
}
