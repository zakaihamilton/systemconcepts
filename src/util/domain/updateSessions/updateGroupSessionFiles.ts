import {
	fileTitle,
	isAudioFile,
	isImageFile,
	isSubtitleFile,
	isVideoFile,
} from "@util/data/path";
import { getYearFingerprint } from "./fingerprints";

export function isYearMetadataFile(file: any, yearName: any) {
	return (
		file.name === yearName + ".tags" ||
		file.name === yearName + ".duration" ||
		file.name === yearName + ".md" ||
		file.name === yearName + ".zip"
	);
}

export function getSessionFileId(file: any) {
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

export function groupFilesBySessionId(files: any, yearName: any) {
	const map: Record<string, any> = {};
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

export function isCandidateSessionId(id: any) {
	// Keep this aligned with createSessionItem's date/name parse so listing
	// entries that can never become sessions do not force endless reprocessing.
	return /^\d{4}-\d{2}-\d{2} .+/.test(String(id || "").trim());
}

export function hasMediaFiles(files: any) {
	return (files || []).some(
		(file: any) =>
			isAudioFile(file.name) ||
			isVideoFile(file.name) ||
			isImageFile(file.name),
	);
}

export function getListingSessionFingerprints(yearItems: any, yearName: any) {
	const wasabiFilesMap = groupFilesBySessionId(yearItems, yearName);
	const fingerprints = Object.create(null);
	for (const [id, files] of Object.entries(wasabiFilesMap)) {
		if (!isCandidateSessionId(id) || !hasMediaFiles(files)) {
			continue;
		}
		fingerprints[id] = JSON.stringify(getYearFingerprint(files));
	}
	return fingerprints;
}

export function getMissingSessionIds(
	yearItems: any,
	cachedYearSessions: any,
	yearName: any,
) {
	const listingFingerprints = getListingSessionFingerprints(
		yearItems,
		yearName,
	);
	const cachedIds = new Set(
		(cachedYearSessions || [])
			.map((session: any) => session.id || session.name)
			.filter(Boolean),
	);
	return Object.keys(listingFingerprints)
		.filter((id) => !cachedIds.has(id))
		.sort((a, b) => a.localeCompare(b));
}

/**
 * When the year listing fingerprint changes but local sessions already exist,
 * only rematerialize sessions whose media set is new or changed — not the
 * entire year (which left large groups stuck at 0/1 Years).
 */
export function getSessionIdsNeedingRefresh(
	yearItems: any,
	cachedYearSessions: any,
	yearName: any,
	previousSessionFingerprints: any,
) {
	const listingFingerprints = getListingSessionFingerprints(
		yearItems,
		yearName,
	);
	const cachedById = new Map<any, any>();
	for (const session of cachedYearSessions || []) {
		const id = session.id || session.name;
		if (id) {
			cachedById.set(id, session);
		}
	}
	const previous = previousSessionFingerprints || {};
	const wasabiFilesMap = groupFilesBySessionId(yearItems, yearName);
	const ids = [];
	for (const [id, listingFp] of Object.entries(listingFingerprints)) {
		const cached = cachedById.get(id);
		if (!cached) {
			ids.push(id);
			continue;
		}
		if (Object.prototype.hasOwnProperty.call(previous, id)) {
			if (previous[id] !== listingFp) {
				ids.push(id);
			}
			continue;
		}
		// Legacy year caches lack per-session fingerprints; fall back to
		// comparing stored file names so we still pick up newly added media.
		// Sessions without a stored file list are treated as unchanged so we
		// do not rematerialize the entire year on the first incremental run.
		if (!cached.files || cached.files.length === 0) {
			continue;
		}
		const wasabiFiles = wasabiFilesMap[id] || [];
		const listingNames = wasabiFiles
			.map((file: any) => file.name)
			.sort()
			.join("\0");
		const cachedNames = [...cached.files].sort().join("\0");
		if (listingNames !== cachedNames) {
			ids.push(id);
		}
	}
	return ids.sort((a, b) => a.localeCompare(b));
}

export function mergeListingSessions(
	listingSessionIds: any,
	cachedYearSessions: any,
	refreshedSessions: any,
) {
	const cachedById = new Map<any, any>();
	for (const session of cachedYearSessions || []) {
		const id = session.id || session.name;
		if (id) {
			cachedById.set(id, session);
		}
	}
	const refreshedById = new Map<any, any>();
	for (const session of refreshedSessions || []) {
		const id = session.id || session.name;
		if (id) {
			refreshedById.set(id, session);
		}
	}
	return listingSessionIds
		.map((id: any) => refreshedById.get(id) || cachedById.get(id))
		.filter(Boolean);
}

export function buildMetadataLookup(map: any) {
	if (!map) return null;
	const normalize = (str: any) =>
		String(str || "")
			.toLowerCase()
			.replace(/[^a-z0-9]/g, "");
	const normalized = new Map<any, any>();
	for (const key of Object.keys(map)) {
		normalized.set(normalize(key), map[key]);
	}
	return { exact: map, normalized, normalize };
}

export function getMetadataValue(mapOrLookup: any, id: any, sessionName: any) {
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
export function hasImageFile(files: any) {
	return (files || []).some((file: any) => isImageFile(file.name));
}

export function getWasabiSessionFiles(wasabiFiles: any) {
	return wasabiFiles || [];
}

export function getDigitalOceanSessionFiles(files: any, wasabiFiles = []) {
	const hasWasabiImage = hasImageFile(wasabiFiles);
	return (files || []).filter(
		(file: any) =>
			!isAudioFile(file.name) &&
			!isVideoFile(file.name) &&
			(!hasWasabiImage || !isImageFile(file.name)),
	);
}
