import { addSyncLog } from "@sync/sync";
import { getCombinedYearFingerprint } from "./fingerprints";
import {
	getListingSessionFingerprints,
	getMissingSessionIds,
	getSessionIdsNeedingRefresh,
	hasImageFile,
	mergeListingSessions,
} from "./updateGroupSessionFiles";
import {
	getCachedSessionsForYear,
	getMetadataFingerprint,
	getSessionDate,
	loadCachedYearSessions,
	readYearCache,
} from "./updateGroupYearMetadata";

function mergeRecentSessions(
	cachedSessions: any[],
	refreshedSessions: any[],
	recentCutoff: string,
) {
	const sessionsById = new Map<any, any>();
	for (const session of cachedSessions || []) {
		const id = session.id || session.name;
		const sessionDate = getSessionDate(id);
		if (!sessionDate || sessionDate < recentCutoff) {
			sessionsById.set(id, session);
		}
	}
	for (const session of refreshedSessions || []) {
		sessionsById.set(session.id || session.name, session);
	}
	return Array.from(sessionsById.values()).sort((a, b) =>
		(a.id || a.name).localeCompare(b.id || b.name),
	);
}

export async function inspectYearRefreshPlan({
	name,
	yearName,
	yearItems,
	groupMetadataFiles,
	existingSessions,
	forceUpdate,
	isMerged,
	isBundled,
	targetSessionId,
	recentCutoff,
}: {
	name: string;
	yearName: string;
	yearItems: any[];
	groupMetadataFiles: any;
	existingSessions: any[];
	forceUpdate: boolean;
	isMerged: boolean;
	isBundled: boolean;
	targetSessionId?: string;
	recentCutoff?: string;
}) {
	const metadataFingerprint = getMetadataFingerprint(
		groupMetadataFiles,
		yearName,
	);
	const yearFingerprint = getCombinedYearFingerprint(
		yearItems,
		metadataFingerprint,
	);
	const cachedYear = await readYearCache(name, yearName);
	const cachedYearSessions =
		isMerged || isBundled
			? getCachedSessionsForYear(existingSessions, yearName)
			: await loadCachedYearSessions(name, yearName, isMerged, isBundled);

	const isTargetInThisYear =
		targetSessionId &&
		(cachedYearSessions || []).some(
			(s: any) => s.id === targetSessionId || s.name === targetSessionId,
		);

	const listingSessionFingerprints = getListingSessionFingerprints(
		yearItems,
		yearName,
	);
	const listingSessionIds = Object.keys(listingSessionFingerprints).sort(
		(a, b) => a.localeCompare(b),
	);
	const missingSessionIds = getMissingSessionIds(
		yearItems,
		cachedYearSessions,
		yearName,
	);
	const fingerprintMatches = cachedYear?.fingerprint === yearFingerprint;
	const hasCachedSessions = cachedYearSessions && cachedYearSessions.length > 0;
	const shouldSkip =
		!forceUpdate &&
		!isTargetInThisYear &&
		fingerprintMatches &&
		missingSessionIds.length === 0 &&
		hasCachedSessions;

	// Prefer incremental rematerialization whenever we already have local sessions.
	const shouldRefreshIncrementally =
		!forceUpdate && !isTargetInThisYear && !recentCutoff && hasCachedSessions;
	const incrementalSessionIds = shouldRefreshIncrementally
		? getSessionIdsNeedingRefresh(
				yearItems,
				cachedYearSessions,
				yearName,
				cachedYear?.sessionFingerprints,
			)
		: null;

	return {
		metadataFingerprint,
		yearFingerprint,
		cachedYearSessions,
		listingSessionFingerprints,
		listingSessionIds,
		shouldSkip,
		shouldRefreshIncrementally,
		incrementalSessionIds,
	};
}

export function selectSessionIdsToProcess({
	name,
	yearName,
	wasabiFilesMap,
	digitalOceanFilesMap,
	listingSessionIds,
	cachedYearSessions,
	shouldRefreshIncrementally,
	incrementalSessionIds,
	recentCutoff,
}: {
	name: string;
	yearName: string;
	wasabiFilesMap: Record<string, any>;
	digitalOceanFilesMap: Record<string, any>;
	listingSessionIds: string[];
	cachedYearSessions: any[];
	shouldRefreshIncrementally: boolean | any;
	incrementalSessionIds: string[] | null;
	recentCutoff?: string;
}) {
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
	const sessionIds = shouldRefreshIncrementally
		? incrementalSessionIds || []
		: shouldRefreshOnlyRecentSessions
			? sortedIds.filter((id) => {
					const sessionDate = getSessionDate(id);
					return sessionDate && sessionDate >= recentCutoff;
				})
			: sortedIds;

	if (shouldRefreshIncrementally) {
		addSyncLog(
			`[${name}/${yearName}] Refreshing ${sessionIds.length} changed session(s) (of ${listingSessionIds.length}).`,
			"info",
		);
	} else if (recentCutoff && !shouldRefreshOnlyRecentSessions) {
		addSyncLog(
			`[${name}/${yearName}] No local year cache; refreshing the full year.`,
			"info",
		);
	}

	return { sessionIds, shouldRefreshOnlyRecentSessions };
}

export function mergeRefreshedSessions({
	shouldRefreshIncrementally,
	shouldRefreshOnlyRecentSessions,
	listingSessionIds,
	cachedYearSessions,
	yearSessions,
	recentCutoff,
}: {
	shouldRefreshIncrementally: boolean | any;
	shouldRefreshOnlyRecentSessions: boolean | string | undefined;
	listingSessionIds: string[];
	cachedYearSessions: any[];
	yearSessions: any[];
	recentCutoff?: string;
}) {
	if (shouldRefreshIncrementally) {
		return mergeListingSessions(
			listingSessionIds,
			cachedYearSessions,
			yearSessions,
		);
	}
	if (shouldRefreshOnlyRecentSessions) {
		return mergeRecentSessions(cachedYearSessions, yearSessions, recentCutoff!);
	}
	return yearSessions;
}
