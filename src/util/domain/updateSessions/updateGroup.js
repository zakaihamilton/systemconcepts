import { writeCompressedFile } from "@sync/bundle";
import {
	FILES_MANIFEST,
	LOCAL_SYNC_PATH,
	SYNC_BASE_PATH,
} from "@sync/constants";
import { getFileInfo } from "@sync/hash";
import { updateManifestEntry } from "@sync/manifest";
import { addSyncLog } from "@sync/sync";
import { SyncActiveStore, UpdateSessionsStore } from "@sync/syncState";
import { logger as structuredLogger } from "@util/api/logger";
import pLimit from "@util/data/p-limit";
import {
	fileFolder,
	fileTitle,
	isAudioFile,
	isDurationFile,
	isImageFile,
	isSubtitleFile,
	isSummaryFile,
	isTagsFile,
	isVideoFile,
	makePath,
} from "@util/data/path";
import storage from "@util/storage/storage";
import { cleanupBundledGroup, cleanupMergedGroup } from "./cleanup";
import {
	getCombinedYearFingerprint,
	getMetadataFileFingerprint,
	normalizeMetadataPayload,
	serializeMetadataFingerprint,
} from "./fingerprints";
import { createSessionItem } from "./mapper";
import {
	loadDurations,
	loadSummaries,
	loadTags,
	loadTranscriptions,
} from "./metadata";
import { fetchSessionMetadata } from "./sessionMetadataClient";
import { getListing, updateYearSync } from "./utils";

const prefix = "wasabi/";
const GROUP_UPDATE_CACHE_PATH = makePath(
	fileFolder(LOCAL_SYNC_PATH),
	".group-update-cache",
);

function isYearMetadataFile(file, yearName) {
	return (
		file.name === yearName + ".tags" ||
		file.name === yearName + ".duration" ||
		file.name === yearName + ".md" ||
		file.name === yearName + ".zip"
	);
}

function getSessionFileId(file) {
	let id = fileTitle(file.name);
	if (isVideoFile(file.name)) {
		const resolutionMatch = id.match(/(.*)_(\d+x\d+)/);
		if (resolutionMatch) {
			id = resolutionMatch[1];
		}
	}
	if (isSubtitleFile(file.name)) {
		id = id.replace(/\.[a-z]{2,3}$/, "");
	}
	return id;
}

function groupFilesBySessionId(files, yearName) {
	const map = {};
	for (const file of files || []) {
		if (isYearMetadataFile(file, yearName)) {
			continue;
		}
		const id = getSessionFileId(file);
		if (!map[id]) {
			map[id] = [];
		}
		map[id].push(file);
	}
	return map;
}

function isCandidateSessionId(id) {
	// Keep this aligned with createSessionItem's date/name parse so listing
	// entries that can never become sessions do not force endless reprocessing.
	return /^\d{4}-\d{2}-\d{2} .+/.test(String(id || "").trim());
}

function getMissingSessionIds(yearItems, cachedYearSessions, yearName) {
	const wasabiFilesMap = groupFilesBySessionId(yearItems, yearName);
	const cachedIds = new Set(
		(cachedYearSessions || [])
			.map((session) => session.id || session.name)
			.filter(Boolean),
	);
	const missingIds = [];
	for (const [id, files] of Object.entries(wasabiFilesMap)) {
		if (!isCandidateSessionId(id)) {
			continue;
		}
		const hasMedia = (files || []).some(
			(file) =>
				isAudioFile(file.name) ||
				isVideoFile(file.name) ||
				isImageFile(file.name),
		);
		if (!hasMedia) {
			continue;
		}
		if (!cachedIds.has(id)) {
			missingIds.push(id);
		}
	}
	return missingIds.sort((a, b) => a.localeCompare(b));
}

function buildMetadataLookup(map) {
	if (!map) return null;
	const normalize = (str) =>
		String(str || "")
			.toLowerCase()
			.replace(/[^a-z0-9]/g, "");
	const normalized = new Map();
	for (const key of Object.keys(map)) {
		normalized.set(normalize(key), map[key]);
	}
	return { exact: map, normalized, normalize };
}

function getMetadataValue(mapOrLookup, id, sessionName) {
	if (!mapOrLookup) return undefined;
	const lookup =
		mapOrLookup.exact && mapOrLookup.normalized
			? mapOrLookup
			: buildMetadataLookup(mapOrLookup);
	if (!lookup) return undefined;
	if (lookup.exact[id] !== undefined) return lookup.exact[id];
	if (sessionName && lookup.exact[sessionName] !== undefined) {
		return lookup.exact[sessionName];
	}
	const normId = lookup.normalize(id);
	if (lookup.normalized.has(normId)) return lookup.normalized.get(normId);
	if (sessionName) {
		const normName = lookup.normalize(sessionName);
		if (normName && lookup.normalized.has(normName)) {
			return lookup.normalized.get(normName);
		}
	}
	return undefined;
}
function hasImageFile(files) {
	return (files || []).some((file) => isImageFile(file.name));
}

function getWasabiSessionFiles(wasabiFiles) {
	return wasabiFiles || [];
}

function getDigitalOceanSessionFiles(files, wasabiFiles = []) {
	const hasWasabiImage = hasImageFile(wasabiFiles);
	return (files || []).filter(
		(file) =>
			!isAudioFile(file.name) &&
			!isVideoFile(file.name) &&
			(!hasWasabiImage || !isImageFile(file.name)),
	);
}

async function getGroupMetadataFiles(groupName) {
	const metadataPath = makePath("aws/sessions", groupName);
	const metadataFiles = new Map();
	try {
		const metadataItems = await getListing(metadataPath);
		for (const item of metadataItems || []) {
			metadataFiles.set(item.name, item);
		}
	} catch (err) {
		structuredLogger.warn(
			`[UpdateGroup] Failed to list metadata for ${groupName}`,
			err,
		);
	}
	return metadataFiles;
}

function getMetadataFingerprint(metadataFiles, yearName) {
	return [".tags", ".duration", ".md", ".zip"].map((extension) =>
		getMetadataFileFingerprint(metadataFiles.get(`${yearName}${extension}`)),
	);
}

function getMetadataFromYearCache(yearCache, metadataFingerprint) {
	if (!yearCache?.metadata) {
		return null;
	}
	const fingerprintKey = serializeMetadataFingerprint(metadataFingerprint);
	if (yearCache.metadataFingerprint !== fingerprintKey) {
		return null;
	}
	return normalizeMetadataPayload(yearCache.metadata);
}

function getYearCachePath(groupName, yearName) {
	return makePath(GROUP_UPDATE_CACHE_PATH, groupName, `${yearName}.json`);
}

async function readYearCache(groupName, yearName) {
	try {
		const path = getYearCachePath(groupName, yearName);
		const content = await storage.readFile(path);
		return content ? JSON.parse(content) : null;
	} catch (err) {
		structuredLogger.warn(
			`[UpdateGroup] Failed to read year cache for ${groupName}/${yearName}`,
			err,
		);
		return null;
	}
}

async function writeYearCache(
	groupName,
	yearName,
	fingerprint,
	metadataFingerprint,
	metadata,
) {
	try {
		const path = getYearCachePath(groupName, yearName);
		await storage.createFolderPath(path);
		await storage.writeFile(
			path,
			JSON.stringify({
				fingerprint,
				metadataFingerprint: serializeMetadataFingerprint(metadataFingerprint),
				metadata: normalizeMetadataPayload(metadata),
				updatedAt: Date.now(),
			}),
		);
	} catch (err) {
		structuredLogger.warn(
			`[UpdateGroup] Failed to write year cache for ${groupName}/${yearName}`,
			err,
		);
	}
}

function getCachedSessionsForYear(existingSessions, yearName) {
	return (existingSessions || []).filter((session) => {
		const id = session.id || session.name || "";
		return (
			String(session.year || "").trim() === String(yearName) ||
			id.startsWith(yearName)
		);
	});
}

function getSessionYear(session) {
	const explicitYear = String(session?.year || "").trim();
	if (/^\d{4}$/.test(explicitYear)) {
		return explicitYear;
	}
	const id = String(session?.id || session?.name || "");
	const match = id.match(/^(\d{4})/);
	return match?.[1] || null;
}

function getSessionDate(id) {
	const match = String(id || "").match(/^(\d{4}-\d{2}-\d{2})(?:\s|$)/);
	return match?.[1] || null;
}

function mergeSessionsById(existingSessions, updatedSessions) {
	const sessions = new Map();
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

async function loadCachedYearSessions(
	groupName,
	yearName,
	isMerged,
	isBundled,
) {
	if (isMerged || isBundled) return [];
	const localYearPath = makePath(
		LOCAL_SYNC_PATH,
		groupName,
		`${yearName}.json`,
	);
	return readSessionsFile(localYearPath);
}

async function getLegacyMetadata(
	year,
	name,
	awsPath,
	forceUpdate,
	isMerged,
	isBundled,
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

async function getMetadataYearItems(metadataYearPath) {
	try {
		const items = await getListing(metadataYearPath);
		items.sort((a, b) => a.name.localeCompare(b.name));
		structuredLogger.debug(
			`[UpdateGroup] Metadata folder ${metadataYearPath} has ${items.length} items`,
		);
		return items;
	} catch (err) {
		structuredLogger.warn(
			`[UpdateGroup] Failed to list metadata folder ${metadataYearPath}`,
			err,
		);
		return [];
	}
}

async function readSessionsFile(path) {
	try {
		if (!(await storage.exists(path))) {
			return [];
		}
		const content = await storage.readFile(path);
		const data = JSON.parse(content);
		return Array.isArray(data?.sessions) ? data.sessions : [];
	} catch (err) {
		structuredLogger.warn(
			`[UpdateGroup] Failed to read cached metadata ${path}`,
			err,
		);
		return [];
	}
}

async function loadCachedYearMetadata(name, yearName, isMerged, isBundled) {
	let sessions = [];

	if (isBundled) {
		const bundlePath = makePath(LOCAL_SYNC_PATH, "bundle.json");
		sessions = (await readSessionsFile(bundlePath)).filter(
			(session) => session.group === name,
		);
	} else if (isMerged) {
		const mergedPath = makePath(LOCAL_SYNC_PATH, `${name}.json`);
		sessions = await readSessionsFile(mergedPath);
	} else {
		const localYearPath = makePath(LOCAL_SYNC_PATH, name, `${yearName}.json`);
		sessions = await readSessionsFile(localYearPath);
	}

	const yearSessions = sessions.filter((session) => {
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

async function getYearMetadata(
	year,
	name,
	forceUpdate,
	isMerged,
	isBundled,
	metadataFingerprint,
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
	} catch (err) {
		structuredLogger.warn(
			`[UpdateGroup] Aggregated metadata fetch failed for ${name}/${year.name}; falling back to legacy metadata reads`,
			err,
		);
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

export async function updateGroupProcess(
	name,
	updateAll,
	forceUpdate = false,
	isMerged = false,
	isBundled = false,
	targetSessionId = null,
	recentDays = null,
) {
	const path = prefix + name;
	let itemIndex = 0;

	if (targetSessionId) {
		addSyncLog(
			`[${name}] Targeted sync requested for session: ${targetSessionId}`,
			"info",
		);
	}

	UpdateSessionsStore.update((s) => {
		itemIndex = s.status.findIndex((item) => item.name === name);
		const statusItem = {
			name: name,
			years: [],
			year: null,
			addedCount: 0,
			removedCount: 0,
			progress: 0,
			count: 0,
			errors: [],
			newSessions: [],
		};
		if (itemIndex === -1) {
			s.status = [...s.status, statusItem];
			itemIndex = s.status.length - 1;
		} else {
			s.status[itemIndex] = statusItem;
			s.status = [...s.status];
		}
	});

	const allSessionNames = new Set();
	const allSessions = [];
	let existingSessions = [];

	// Merged and bundled updates always begin with the persisted group. Freshly
	// processed years are overlaid later, so a partial remote year listing cannot
	// silently erase historical sessions.
	if (isMerged || isBundled) {
		if (isBundled) {
			const bundlePath = makePath(LOCAL_SYNC_PATH, "bundle.json");
			try {
				if (await storage.exists(bundlePath)) {
					const content = await storage.readFile(bundlePath);
					const data = JSON.parse(content);
					if (data && Array.isArray(data.sessions)) {
						existingSessions = data.sessions.filter((s) => s.group === name);
					}
				}
			} catch (err) {
				structuredLogger.warn(
					`[Sync] Failed to read existing bundle file ${bundlePath}`,
					err,
				);
			}
		} else {
			const localGroupPath = makePath(LOCAL_SYNC_PATH, `${name}.json`);
			try {
				if (await storage.exists(localGroupPath)) {
					const content = await storage.readFile(localGroupPath);
					const data = JSON.parse(content);
					if (data && Array.isArray(data.sessions)) {
						existingSessions = data.sessions;
					}
				}
			} catch (err) {
				structuredLogger.warn(
					`[Sync] Failed to read existing group file ${localGroupPath}`,
					err,
				);
			}
		}
		if (existingSessions.length > 0) {
			allSessions.push(...existingSessions);
		}
	}

	let years = [];
	try {
		structuredLogger.debug(`[UpdateGroup] Fetching listing for path: ${path}`);
		const fullListing = await getListing(path);
		structuredLogger.debug(
			`[UpdateGroup] Received ${fullListing?.length || 0} items from listing`,
		);
		if (fullListing && fullListing.length > 0) {
			structuredLogger.debug(
				`[UpdateGroup] First item:`,
				JSON.stringify(fullListing[0]),
			);
		}
		years = fullListing.filter((item) => {
			const isDir = item.type === "dir" || item.stat?.type === "dir";
			const isYear = !isNaN(parseInt(item.name)) && /^\d+$/.test(item.name);
			return isDir && isYear;
		});
		structuredLogger.debug(
			`[UpdateGroup] Filtered to ${years.length} year folders:`,
			years.map((y) => y.name),
		);
	} catch (err) {
		structuredLogger.error(err);
		UpdateSessionsStore.update((s) => {
			s.status[itemIndex].errors.push(err.message || String(err));
			s.status = [...s.status];
		});
		// Abort the process to prevent data corruption (writing empty files)
		return;
	}

	if (updateAll && (isMerged || isBundled) && existingSessions.length > 0) {
		const listedYears = new Set(years.map((year) => String(year.name)));
		const existingYears = new Set(
			existingSessions.map(getSessionYear).filter(Boolean),
		);
		const missingYears = [...existingYears]
			.filter((year) => !listedYears.has(year))
			.sort();
		if (missingYears.length > 0) {
			const message =
				`[${name}] Remote year listing omitted locally stored years ` +
				`(${missingYears.join(", ")}). Preserving those sessions; retry the full update.`;
			structuredLogger.warn(`[UpdateGroup] ${message}`);
			addSyncLog(message, "warning");
		}
	}

	const recentCutoff =
		typeof recentDays === "number" && recentDays > 0
			? new Date(Date.now() - recentDays * 24 * 60 * 60 * 1000)
					.toISOString()
					.slice(0, 10)
			: null;
	if (recentCutoff) {
		const cutoffYear = recentCutoff.slice(0, 4);
		const currentYear = String(new Date().getFullYear());
		years = years.filter(
			(year) => year.name >= cutoffYear && year.name <= currentYear,
		);
	} else if (!updateAll) {
		const currentYear = new Date().getFullYear();
		years = years.filter((year) => {
			const yearName = parseInt(year.name);
			return yearName === currentYear;
		});
	}

	const groupMetadataFiles = await getGroupMetadataFiles(name);
	const limit = pLimit(4);

	UpdateSessionsStore.update((s) => {
		s.status[itemIndex].count = years.length;
		s.status = [...s.status];
	});

	const promises = years.map((year) =>
		limit(async () => {
			UpdateSessionsStore.update((s) => {
				s.status[itemIndex].years.push(year.name);
				s.status[itemIndex].year = year.name;
				s.status = [...s.status];
			});

			try {
				structuredLogger.debug(
					`[UpdateGroup] Fetching items for year: ${year.name}, path: ${year.path}`,
				);
				const yearItems = await getListing(year.path);
				structuredLogger.debug(
					`[UpdateGroup] Year ${year.name} has ${yearItems?.length || 0} items`,
				);
				yearItems.sort((a, b) => a.name.localeCompare(b.name));
				const metadataFingerprint = getMetadataFingerprint(
					groupMetadataFiles,
					year.name,
				);
				const yearFingerprint = getCombinedYearFingerprint(
					yearItems,
					metadataFingerprint,
				);
				const cachedYear = await readYearCache(name, year.name);
				const cachedYearSessions =
					isMerged || isBundled
						? getCachedSessionsForYear(existingSessions, year.name)
						: await loadCachedYearSessions(
								name,
								year.name,
								isMerged,
								isBundled,
							);

				const isTargetInThisYear =
					targetSessionId &&
					(cachedYearSessions || []).some(
						(s) => s.id === targetSessionId || s.name === targetSessionId,
					);

				const missingSessionIds = getMissingSessionIds(
					yearItems,
					cachedYearSessions,
					year.name,
				);
				const fingerprintMatches =
					cachedYear?.fingerprint === yearFingerprint;
				const hasCachedSessions =
					cachedYearSessions && cachedYearSessions.length > 0;
				if (
					!forceUpdate &&
					!isTargetInThisYear &&
					fingerprintMatches &&
					missingSessionIds.length === 0 &&
					hasCachedSessions
				) {
					if (isMerged || isBundled) {
						allSessions.push(...cachedYearSessions);
					}
					for (const session of cachedYearSessions) {
						allSessionNames.add(session.id || session.name);
					}
					addSyncLog(
						`[${name}/${year.name}] ✓ Skipped unchanged year.`,
						"info",
					);
					return;
				}

				// When the listing fingerprint is unchanged but local cache is
				// missing media sessions, only materialize those IDs instead of
				// reprocessing the entire year (which hung large groups at 0/1).
				const shouldOnlyFillMissing =
					!forceUpdate &&
					!isTargetInThisYear &&
					!recentCutoff &&
					fingerprintMatches &&
					missingSessionIds.length > 0 &&
					hasCachedSessions;

				const metadata = await getYearMetadata(
					year,
					name,
					forceUpdate,
					isMerged,
					isBundled,
					metadataFingerprint,
				);
				const metadataYearItems = metadata.items;
				const sessionTagsMap = buildMetadataLookup(metadata.tags);
				const sessionDurationMap = buildMetadataLookup(metadata.durations);
				const sessionSummariesMap = buildMetadataLookup(metadata.summaries);
				const sessionTranscriptionMap = buildMetadataLookup(
					metadata.transcriptions,
				);

				const wasabiFilesMap = groupFilesBySessionId(yearItems, year.name);
				const digitalOceanFilesMap = groupFilesBySessionId(
					metadataYearItems,
					year.name,
				);
				const sortedIds = Array.from(
					new Set([
						...Object.keys(wasabiFilesMap),
						...Object.keys(digitalOceanFilesMap).filter((id) =>
							hasImageFile(digitalOceanFilesMap[id]),
						),
					]),
				).sort((a, b) => a.localeCompare(b));
				const shouldRefreshOnlyRecentSessions =
					recentCutoff && cachedYearSessions && cachedYearSessions.length > 0;
				let sessionIds = shouldOnlyFillMissing
					? missingSessionIds
					: shouldRefreshOnlyRecentSessions
						? sortedIds.filter((id) => {
								const sessionDate = getSessionDate(id);
								return sessionDate && sessionDate >= recentCutoff;
							})
						: sortedIds;

				if (shouldOnlyFillMissing) {
					addSyncLog(
						`[${name}/${year.name}] Adding ${missingSessionIds.length} missing session(s).`,
						"info",
					);
				} else if (recentCutoff && !shouldRefreshOnlyRecentSessions) {
					addSyncLog(
						`[${name}/${year.name}] No local year cache; refreshing the full year.`,
						"info",
					);
				}

				UpdateSessionsStore.update((s) => {
					s.status[itemIndex].sessionProgress = 0;
					s.status[itemIndex].sessionCount = sessionIds.length;
					s.status = [...s.status];
				});

				let completedSessions = 0;
				const yearSessionsLimit = pLimit(10);
				const yearSessions = (
					await Promise.all(
						sessionIds.map((id) =>
							yearSessionsLimit(async () => {
								try {
									if (targetSessionId && id !== targetSessionId) {
										const cachedSession = (cachedYearSessions || []).find(
											(s) => s.id === id || s.name === id,
										);
										if (cachedSession) {
											return cachedSession;
										}
									} else if (targetSessionId && id === targetSessionId) {
										addSyncLog(
											`[${name}] Force re-fetching metadata for targeted session: ${id}`,
											"info",
										);
									}

									const [, , sessionName] =
										id.trim().match(/(\d+-\d+-\d+) (.*)/) || [];
									let tags =
										getMetadataValue(sessionTagsMap, id, sessionName) || [];
									let duration = getMetadataValue(
										sessionDurationMap,
										id,
										sessionName,
									);
									let summary = getMetadataValue(
										sessionSummariesMap,
										id,
										sessionName,
									);
									let transcription = getMetadataValue(
										sessionTranscriptionMap,
										id,
										sessionName,
									);
									if (targetSessionId && id === targetSessionId) {
										addSyncLog(
											`[${name}] Resolved metadata keys - id: "${id}", sessionName: "${sessionName || "none"}"`,
											"info",
										);
										addSyncLog(
											`[${name}] Resolved tags from S3: ${JSON.stringify(tags)}`,
											"info",
										);
										addSyncLog(
											`[${name}] Resolved duration from S3: ${duration || "none"}`,
											"info",
										);
										addSyncLog(
											`[${name}] Resolved summary from S3: ${summary ? summary.substring(0, 80) + "..." : "none"}`,
											"info",
										);
										addSyncLog(
											`[${name}] Resolved transcription from S3: ${transcription || "none"}`,
											"info",
										);
									}
									let transcriptPath = null;
									const wasabiFiles = wasabiFilesMap[id] || [];
									const digitalOceanFiles = getDigitalOceanSessionFiles(
										digitalOceanFilesMap[id],
										wasabiFiles,
									);
									const files = [
										...getWasabiSessionFiles(wasabiFiles),
										...digitalOceanFiles,
									];
									const metadataFallbackFiles = [
										...digitalOceanFiles,
										...wasabiFiles,
									];

									if (!tags.length) {
										const tagsFile = metadataFallbackFiles.find((f) =>
											isTagsFile(f.name),
										);
										if (tagsFile) {
											try {
												const content = await storage.readFile(tagsFile.path);
												const parsed = JSON.parse(content);
												if (Array.isArray(parsed)) {
													tags = parsed;
												} else if (parsed && Array.isArray(parsed.tags)) {
													tags = parsed.tags;
												}
											} catch (err) {
												structuredLogger.warn(
													`[Sync] Failed to read tags file ${tagsFile.path}`,
													err,
												);
											}
										}
									}

									if (!duration || duration < 1) {
										const durationFile = metadataFallbackFiles.find((f) =>
											isDurationFile(f.name),
										);
										if (durationFile) {
											try {
												const content = await storage.readFile(
													durationFile.path,
												);
												try {
													const parsed = JSON.parse(content);
													if (parsed && typeof parsed.duration === "number") {
														duration = parsed.duration;
													} else {
														duration = parseFloat(content);
													}
												} catch {
													duration = parseFloat(content);
												}
											} catch (err) {
												structuredLogger.warn(
													`[Sync] Failed to read duration file ${durationFile.path}`,
													err,
												);
											}
										}
									}

									if (!summary) {
										const summaryFile = metadataFallbackFiles.find((f) =>
											isSummaryFile(f.name),
										);
										if (summaryFile) {
											try {
												summary = await storage.readFile(summaryFile.path);
											} catch (err) {
												structuredLogger.warn(
													`[Sync] Failed to read summary file ${summaryFile.path}`,
													err,
												);
											}
										}
									}

									// If not in consolidated zip, check for individual file or .txt inside the folder.
									// Usually it's sessionID.txt. If we didn't get it from zip, check files list.
									if (!transcription) {
										const txtFile = metadataFallbackFiles.find((f) =>
											f.name.toLowerCase().endsWith(".txt"),
										);
										if (txtFile) {
											transcription = true;
											transcriptPath = txtFile.path;
										}
									}

									const item = createSessionItem(
										id,
										files,
										year.name,
										name,
										tags,
										duration,
										summary,
										transcription,
										transcriptPath,
									);

									if (targetSessionId && id === targetSessionId) {
										addSyncLog(
											`[${name}] Targeted session metadata updated successfully: ${id}`,
											"success",
										);
									}

									return item;
								} finally {
									completedSessions++;
									if (
										completedSessions === sessionIds.length ||
										completedSessions % 25 === 0
									) {
										UpdateSessionsStore.update((s) => {
											s.status[itemIndex].sessionProgress = completedSessions;
											s.status[itemIndex].sessionCount = sessionIds.length;
											s.status = [...s.status];
										});
									}
								}
							}),
						),
					)
				).filter(Boolean);

				const sessionsToPersist =
					shouldRefreshOnlyRecentSessions || shouldOnlyFillMissing
						? mergeSessionsById(cachedYearSessions, yearSessions)
						: yearSessions;

				if (isMerged || isBundled) {
					// Always persist the full year view: fill-missing / recent
					// refreshes only process a subset, so push the merged result.
					allSessions.push(...sessionsToPersist);
				} else {
					const { counter, newCount, newSessions } = await updateYearSync(
						name,
						year.name,
						sessionsToPersist,
					);
					// Track sessions for total count regardless of whether file was updated
					sessionsToPersist.forEach((session) =>
						allSessionNames.add(session.id),
					);

					if (counter > 0) {
						UpdateSessionsStore.update((s) => {
							s.status[itemIndex].addedCount += newCount;
							s.status[itemIndex].newSessions.push(
								...newSessions.map((s) => ({
									name: s.id,
									files: s.files || [],
									metadata: {
										hasTags: Array.isArray(s.tags) && s.tags.length > 0,
										hasDuration:
											typeof s.duration === "number" && s.duration > 0.5,
										hasSummary: !!s.summaryText || !!s.summary,
										hasTranscription: !!s.transcription,
										hasThumbnail: !!s.thumbnail || !!s.image,
									},
								})),
							);
							s.status = [...s.status];
						});
					}
				}
				await writeYearCache(
					name,
					year.name,
					yearFingerprint,
					metadataFingerprint,
					{
						items: metadataYearItems,
						tags: metadata.tags,
						durations: metadata.durations,
						summaries: metadata.summaries,
						transcriptions: metadata.transcriptions,
					},
				);
			} catch (err) {
				structuredLogger.error(err);
				UpdateSessionsStore.update((s) => {
					s.status[itemIndex].errors.push(err.message || String(err));
					s.status = [...s.status];
				});
				throw err; // Abort this year's processing and fail the group update
			} finally {
				UpdateSessionsStore.update((s) => {
					s.status[itemIndex].progress++;
					s.status[itemIndex].sessionProgress = 0;
					s.status[itemIndex].sessionCount = 0;
					s.status = [...s.status];
				});
			}
		}),
	);
	try {
		await Promise.all(promises);
	} catch {
		structuredLogger.error(
			`[Sync] Group ${name} failed to process all years. Aborting write to prevent corruption.`,
		);
		return;
	}

	if (isBundled) {
		// For bundled groups:
		// 1. Deduplicate sessions (preferring fresh ones from this sync)
		const sessionMap = new Map();
		allSessions.forEach((s) => sessionMap.set(s.id, s));
		const uniqueSessions = Array.from(sessionMap.values());
		uniqueSessions.sort((a, b) => a.id.localeCompare(b.id));

		if (existingSessions) {
			existingSessions.sort((a, b) => a.id.localeCompare(b.id));
			const uniqueSessionsStr = JSON.stringify(uniqueSessions);
			const existingSessionsStr = JSON.stringify(existingSessions);

			if (uniqueSessionsStr === existingSessionsStr && !forceUpdate) {
				addSyncLog(`[${name}] ✓ Verified (no changes).`, "success");
				return uniqueSessions;
			}
		}

		// 2. Cleanup
		await cleanupBundledGroup(name);

		const existingIds = new Set(existingSessions.map((s) => s.id));
		const newSessionItems = uniqueSessions.filter(
			(s) => !existingIds.has(s.id),
		);
		const addedCount = newSessionItems.length;

		UpdateSessionsStore.update((s) => {
			s.status[itemIndex].addedCount = addedCount;
			s.status[itemIndex].newSessions.push(
				...newSessionItems.map((s) => ({
					name: s.id,
					files: s.files || [],
					metadata: {
						hasTags: Array.isArray(s.tags) && s.tags.length > 0,
						hasDuration: typeof s.duration === "number" && s.duration > 0.5,
						hasSummary: !!s.summaryText || !!s.summary,
						hasTranscription: !!s.transcription,
						hasThumbnail: !!s.thumbnail || !!s.image,
					},
				})),
			);
			s.status = [...s.status];
		});
		uniqueSessions.forEach((session) => allSessionNames.add(session.id));

		return uniqueSessions;
	}

	if (isMerged) {
		// For merged groups:
		// 1. Deduplicate sessions (preferring fresh ones from this sync)
		const sessionMap = new Map();
		allSessions.forEach((s) => sessionMap.set(s.id, s));
		const uniqueSessions = Array.from(sessionMap.values());
		uniqueSessions.sort((a, b) => a.id.localeCompare(b.id));

		let hasChanges = true;
		if (existingSessions) {
			existingSessions.sort((a, b) => a.id.localeCompare(b.id));
			const uniqueSessionsStr = JSON.stringify(uniqueSessions);
			const existingSessionsStr = JSON.stringify(existingSessions);

			if (uniqueSessionsStr === existingSessionsStr && !forceUpdate) {
				hasChanges = false;
				addSyncLog(`[${name}] ✓ Verified (no changes).`, "success");
				return;
			}
		}

		if (hasChanges) {
			// 2. Write ONE merged file
			const localGroupPath = makePath(LOCAL_SYNC_PATH, `${name}.json`);
			const groupData = {
				version: 1,
				group: name,
				date: Date.now(),
				sessions: uniqueSessions,
			};
			await writeCompressedFile(localGroupPath, groupData);

			// Update local manifest immediately so useSessions can see it
			try {
				const content = await storage.readFile(localGroupPath);
				const info = await getFileInfo(content);
				const manifestPath = makePath(LOCAL_SYNC_PATH, FILES_MANIFEST);
				const relPath = localGroupPath.substring(
					makePath(LOCAL_SYNC_PATH).length,
				);
				const entry = {
					path: relPath.startsWith("/") ? relPath : "/" + relPath,
					hash: info.hash,
					size: info.size,
					version: Date.now().toString(), // Use timestamp to ensure it's "newer"
				};
				await updateManifestEntry(manifestPath, entry);
				structuredLogger.debug(`[Sync] Updated local manifest for ${relPath}`);
			} catch (err) {
				structuredLogger.warn(
					`[Sync] Failed to update local manifest for ${localGroupPath}`,
					err,
				);
			}

			// 3. Cleanup
			await cleanupMergedGroup(name);
		}

		const existingIds = new Set(existingSessions.map((s) => s.id));
		const newSessionItems = uniqueSessions.filter(
			(s) => !existingIds.has(s.id),
		);
		const addedCount = newSessionItems.length;

		UpdateSessionsStore.update((s) => {
			s.status[itemIndex].addedCount = addedCount;
			s.status[itemIndex].newSessions.push(
				...newSessionItems.map((s) => ({
					name: s.id,
					files: s.files || [],
					metadata: {
						hasTags: Array.isArray(s.tags) && s.tags.length > 0,
						hasDuration: typeof s.duration === "number" && s.duration > 0.5,
						hasSummary: !!s.summaryText || !!s.summary,
						hasTranscription: !!s.transcription,
						hasThumbnail: !!s.thumbnail || !!s.image,
					},
				})),
			);
			s.status = [...s.status];
		});
		uniqueSessions.forEach((session) => allSessionNames.add(session.id));
	} else {
		// For split (enabled) groups:
		// 1. Check if we need to migrate from a merged file (e.g. settings changed or first sync after migration)
		const localGroupPath = makePath(LOCAL_SYNC_PATH, `${name}.json`);
		if (await storage.exists(localGroupPath)) {
			try {
				const content = await storage.readFile(localGroupPath);
				const data = JSON.parse(content);
				if (data && data.sessions) {
					// Group by year
					const byYear = {};
					data.sessions.forEach((s) => {
						if (!byYear[s.year]) byYear[s.year] = [];
						byYear[s.year].push(s);
					});

					// Write year files for years NOT processed in this sync
					// (Processed years are already written by updateYearSync above)
					const processedYears = new Set(years.map((y) => y.name));
					for (const [year, sessions] of Object.entries(byYear)) {
						if (!processedYears.has(year)) {
							await updateYearSync(name, year, sessions);
						}
					}
				}
			} catch (err) {
				structuredLogger.error("Error migrating from merged file", err);
			}
			// 2. Delete local merged file
			await storage.deleteFile(localGroupPath);

			// 3. Delete remote merged file from AWS
			const remoteGroupPath = makePath(SYNC_BASE_PATH, `${name}.json.gz`);
			try {
				if (await storage.exists(remoteGroupPath)) {
					structuredLogger.debug(
						`[Sync] Deleting remote merged file: ${remoteGroupPath}`,
					);
					await storage.deleteFile(remoteGroupPath);
					structuredLogger.debug(
						`[Sync] Successfully deleted remote merged file`,
					);
				}
			} catch (err) {
				structuredLogger.error(
					`[Sync] Error deleting remote merged file for ${name}:`,
					err,
				);
			}
		}
	}

	// Retrieve the final status for this group to avoid stale index issues
	const finalStatus =
		(UpdateSessionsStore.getRawState().status || []).find(
			(s) => s.name === name,
		) || {};
	const addedCount = finalStatus.addedCount || 0;
	const newSessions = finalStatus.newSessions || [];

	UpdateSessionsStore.update((s) => {
		const idx = s.status.findIndex((item) => item.name === name);
		if (idx !== -1) {
			s.status[idx].progress = years.length;
			s.status[idx].year = null;
			s.status = [...s.status];
		}
	});

	const sortedSessions = [...allSessionNames].sort();
	const totalCount = sortedSessions.length;

	// Use the last newly added session if available, otherwise fallback to last overall
	let lastSession = "";
	if (newSessions.length > 0) {
		const sortedNew = newSessions.map((s) => s.name).sort();
		lastSession = sortedNew[sortedNew.length - 1];
	} else if (totalCount > 0) {
		lastSession = sortedSessions[totalCount - 1];
	}

	const lastSessionMsg = lastSession ? `, last: ${lastSession}` : "";
	const newMsg = addedCount > 0 ? `, ${addedCount} updated` : ", no updates";

	if (addedCount > 0 || targetSessionId) {
		SyncActiveStore.update((s) => {
			s.needsSessionReload = true;
		});
	}

	addSyncLog(
		`[${name}] ✓ Updated (${totalCount} sessions${newMsg}${lastSessionMsg}).`,
		"success",
	);
}
