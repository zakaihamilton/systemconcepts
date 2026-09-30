import { addSyncLog } from "@sync/sync";
import { UpdateSessionsStore } from "@sync/syncState";
import { logger as structuredLogger } from "@util/api/logger";
import pLimit from "@util/data/p-limit";
import { isDurationFile, isSummaryFile, isTagsFile } from "@util/data/path";
import storage from "@util/storage/storage";
import { getCombinedYearFingerprint } from "./fingerprints";
import { createSessionItem } from "./mapper";
import { recordGroupError, toSessionProgress } from "./sessionProgress";
import {
	buildMetadataLookup,
	getDigitalOceanSessionFiles,
	getListingSessionFingerprints,
	getMetadataValue,
	getMissingSessionIds,
	getSessionIdsNeedingRefresh,
	getWasabiSessionFiles,
	groupFilesBySessionId,
	hasImageFile,
	mergeListingSessions,
} from "./updateGroupSessionFiles";
import {
	getCachedSessionsForYear,
	getMetadataFingerprint,
	getSessionDate,
	getYearMetadata,
	loadCachedYearSessions,
	mergeSessionsById,
	readYearCache,
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
		const yearItems = await getListing(year.path);
		structuredLogger.debug(
			`[UpdateGroup] Year ${year.name} has ${yearItems?.length || 0} items`,
		);
		yearItems.sort((a: any, b: any) => a.name.localeCompare(b.name));
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
				: await loadCachedYearSessions(name, year.name, isMerged, isBundled);

		const isTargetInThisYear =
			targetSessionId &&
			(cachedYearSessions || []).some(
				(s: any) => s.id === targetSessionId || s.name === targetSessionId,
			);

		const listingSessionFingerprints = getListingSessionFingerprints(
			yearItems,
			year.name,
		);
		const listingSessionIds = Object.keys(listingSessionFingerprints).sort(
			(a, b) => a.localeCompare(b),
		);
		const missingSessionIds = getMissingSessionIds(
			yearItems,
			cachedYearSessions,
			year.name,
		);
		const fingerprintMatches = cachedYear?.fingerprint === yearFingerprint;
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
			addSyncLog(`[${name}/${year.name}] ✓ Skipped unchanged year.`, "info");
			return;
		}

		// Prefer incremental rematerialization whenever we already have local
		// sessions. A changed year fingerprint (new Wasabi media) used to force
		// a full-year rebuild and hang large groups before any progress painted.
		const shouldRefreshIncrementally =
			!forceUpdate && !isTargetInThisYear && !recentCutoff && hasCachedSessions;
		const incrementalSessionIds = shouldRefreshIncrementally
			? getSessionIdsNeedingRefresh(
					yearItems,
					cachedYearSessions,
					year.name,
					cachedYear?.sessionFingerprints,
				)
			: null;

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
		let sessionIds = shouldRefreshIncrementally
			? incrementalSessionIds || []
			: shouldRefreshOnlyRecentSessions
				? sortedIds.filter((id) => {
						const sessionDate = getSessionDate(id);
						return sessionDate && sessionDate >= recentCutoff;
					})
				: sortedIds;

		if (shouldRefreshIncrementally) {
			addSyncLog(
				`[${name}/${year.name}] Refreshing ${sessionIds.length} changed session(s) (of ${listingSessionIds.length}).`,
				"info",
			);
		} else if (recentCutoff && !shouldRefreshOnlyRecentSessions) {
			addSyncLog(
				`[${name}/${year.name}] No local year cache; refreshing the full year.`,
				"info",
			);
		}

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
							if (targetSessionId && id !== targetSessionId) {
								const cachedSession = (cachedYearSessions || []).find(
									(s: any) => s.id === id || s.name === id,
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
									} catch (err: any) {
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
										const content = await storage.readFile(durationFile.path);
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
									} catch (err: any) {
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
									} catch (err: any) {
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
			shouldRefreshOnlyRecentSessions || shouldRefreshIncrementally
				? shouldRefreshIncrementally
					? mergeListingSessions(
							listingSessionIds,
							cachedYearSessions,
							yearSessions,
						)
					: mergeSessionsById(cachedYearSessions, yearSessions)
				: yearSessions;

		// Persist can take a long time for large years; surface it so the UI
		// does not look stuck at N/N sessions with an empty year bar.
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
			// Always persist the full year view: fill-missing / recent
			// refreshes only process a subset, so push the merged result.
			allSessions.push(...sessionsToPersist);
		} else {
			const { counter, newCount, newSessions } = await updateYearSync(
				name,
				year.name,
				sessionsToPersist,
				cachedYearSessions,
			);
			// Track sessions for total count regardless of whether file was updated
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
		// Year cache is an optimization — defer so it does not contend with
		// other local FS work during the persist phase.
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
		throw err; // Abort this year's processing and fail the group update
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
