import { addSyncLog } from "@sync/sync";
import { UpdateSessionsStore } from "@sync/syncState";
import { logger as structuredLogger } from "@util/api/logger";
import pLimit from "@util/data/p-limit";
import {
	inspectYearRefreshPlan,
	mergeRefreshedSessions,
	selectSessionIdsToProcess,
} from "./planYearRefresh";
import { resolveSessionMetadata } from "./resolveSessionMetadata";
import { recordGroupError, toSessionProgress } from "./sessionProgress";
import {
	buildMetadataLookup,
	groupFilesBySessionId,
} from "./updateGroupSessionFiles";
import {
	getSessionYear,
	getYearMetadata,
	writeYearCache,
} from "./updateGroupYearMetadata";
import { getListing, updateYearSync, yieldToMain } from "./utils";

export async function processGroupYear({
	name,
	year,
	forceUpdate,
	isMerged,
	isBundled,
	targetSessionId,
	recentCutoff,
	groupMetadataFiles,
	existingSessions,
	allSessions,
	allSessionNames,
	itemIndex,
}: any) {
	UpdateSessionsStore.update((s) => {
		s.status[itemIndex].years.push(year.name);
		s.status[itemIndex].year = year.name;
		s.status = [...s.status];
	});

	try {
		structuredLogger.debug(
			`[UpdateGroup] Fetching items for year: ${year.name}, path: ${year.path}`,
		);
		const yearItems = await getListing(year.path, { strict: true });
		structuredLogger.debug(
			`[UpdateGroup] Year ${year.name} has ${yearItems?.length || 0} items`,
		);
		yearItems.sort((a: any, b: any) => a.name.localeCompare(b.name));

		const {
			metadataFingerprint,
			yearFingerprint,
			cachedYearSessions,
			listingSessionFingerprints,
			listingSessionIds,
			shouldSkip,
			shouldRefreshIncrementally,
			incrementalSessionIds,
		} = await inspectYearRefreshPlan({
			name,
			yearName: year.name,
			yearItems,
			groupMetadataFiles,
			existingSessions,
			forceUpdate,
			isMerged,
			isBundled,
			targetSessionId,
			recentCutoff,
		});

		if (shouldSkip) {
			if (isMerged || isBundled) {
				allSessions.push(...cachedYearSessions);
			}
			for (const session of cachedYearSessions) {
				allSessionNames.add(session.id || session.name);
			}
			addSyncLog(`[${name}/${year.name}] ✓ Skipped unchanged year.`, "info");
			return;
		}

		UpdateSessionsStore.update((s) => {
			s.status[itemIndex].phase = "metadata";
			s.status[itemIndex].year = year.name;
			s.status[itemIndex].sessionProgress = 0;
			s.status[itemIndex].sessionCount = 0;
			s.status = [...s.status];
		});

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

		const { sessionIds, shouldRefreshOnlyRecentSessions } =
			selectSessionIdsToProcess({
				name,
				yearName: year.name,
				wasabiFilesMap,
				digitalOceanFilesMap,
				listingSessionIds,
				cachedYearSessions,
				shouldRefreshIncrementally,
				incrementalSessionIds,
				recentCutoff,
			});

		UpdateSessionsStore.update((s) => {
			s.status[itemIndex].phase = "sessions";
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
							return await resolveSessionMetadata({
								id,
								name,
								yearName: year.name,
								targetSessionId,
								cachedYearSessions,
								wasabiFilesMap,
								digitalOceanFilesMap,
								sessionTagsMap,
								sessionDurationMap,
								sessionSummariesMap,
								sessionTranscriptionMap,
							});
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

		const sessionsToPersist = mergeRefreshedSessions({
			shouldRefreshIncrementally,
			shouldRefreshOnlyRecentSessions,
			listingSessionIds,
			cachedYearSessions,
			yearSessions,
			recentCutoff,
		});

		UpdateSessionsStore.update((s) => {
			s.status[itemIndex].phase = "persisting";
			s.status = [...s.status];
		});
		await yieldToMain();
		addSyncLog(
			`[${name}/${year.name}] Persisting ${sessionsToPersist.length} session(s)…`,
			"info",
		);

		if (isMerged || isBundled) {
			for (let index = allSessions.length - 1; index >= 0; index--) {
				if (getSessionYear(allSessions[index]) === String(year.name)) {
					allSessions.splice(index, 1);
				}
			}
			allSessions.push(...sessionsToPersist);
		} else {
			const { counter, newCount, newSessions } = await updateYearSync(
				name,
				year.name,
				sessionsToPersist,
				cachedYearSessions,
			);
			sessionsToPersist.forEach((session: any) =>
				allSessionNames.add(session.id),
			);

			if (counter > 0) {
				UpdateSessionsStore.update((s) => {
					s.status[itemIndex].addedCount += newCount;
					s.status[itemIndex].newSessions.push(
						...newSessions.map(toSessionProgress),
					);
					s.status = [...s.status];
				});
			}
		}

		// Year cache is an optimization — defer so it does not contend with other local FS work.
		void (async () => {
			try {
				await new Promise((resolve) => setTimeout(resolve, 800));
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
					listingSessionFingerprints,
				);
			} catch (err: any) {
				structuredLogger.warn(
					`[UpdateGroup] Deferred year cache write failed for ${name}/${year.name}`,
					err,
				);
			}
		})();
	} catch (err: any) {
		structuredLogger.error(err);
		recordGroupError(itemIndex, err);
		throw err;
	} finally {
		UpdateSessionsStore.update((s) => {
			s.status[itemIndex].progress++;
			s.status[itemIndex].sessionProgress = 0;
			s.status[itemIndex].sessionCount = 0;
			s.status[itemIndex].phase = null;
			s.status = [...s.status];
		});
	}
}
