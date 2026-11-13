import { LOCAL_SYNC_PATH } from "@sync/constants";
import { addSyncLog } from "@sync/sync";
import { SyncActiveStore, UpdateSessionsStore } from "@sync/syncState";
import { logger as structuredLogger } from "@util/api/logger";
import pLimit from "@util/data/p-limit";
import { makePath } from "@util/data/path";
import storage from "@util/storage/storage";
import { persistGroupSessions } from "./persistGroupSessions";
import { processGroupYear } from "./processGroupYear";
import { recordGroupError } from "./sessionProgress";
import {
	getGroupMetadataFiles,
	getSessionDate,
	getSessionYear,
	loadCachedYearSessions,
} from "./updateGroupYearMetadata";
import { getListing, updateYearSync } from "./utils";

const prefix = "wasabi/";

function isOutsideRecentWindow(session: any, cutoff: string) {
	const sessionDate = getSessionDate(session.id || session.name);
	return !sessionDate || sessionDate < cutoff;
}

export async function updateGroupProcess(
	name: any,
	updateAll: any,
	forceUpdate = false,
	isMerged = false,
	isBundled = false,
	targetSessionId: string | null = null,
	recentDays: number | null = null,
	reconcileMissingYears = false,
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

	const allSessionNames = new Set<any>();
	const allSessions: import("../../../types/domain").Session[] = [];
	let existingSessions = [];

	// Merged and bundled updates start from the persisted group. Processed years
	// replace their cached entries later; explicit full refreshes also reconcile
	// cached years missing from the remote listing.
	if (isMerged || isBundled) {
		if (isBundled) {
			const bundlePath = makePath(LOCAL_SYNC_PATH, "bundle.json");
			try {
				if (await storage.exists(bundlePath)) {
					const content = await storage.readFile(bundlePath);
					const data = JSON.parse(content);
					if (data && Array.isArray(data.sessions)) {
						existingSessions = data.sessions.filter(
							(s: any) => s.group === name,
						);
					}
				}
			} catch (err: any) {
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
			} catch (err: any) {
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
		const fullListing = await getListing(path, { strict: true });
		structuredLogger.debug(
			`[UpdateGroup] Received ${fullListing?.length || 0} items from listing`,
		);
		if (fullListing && fullListing.length > 0) {
			structuredLogger.debug(
				`[UpdateGroup] First item:`,
				JSON.stringify(fullListing[0]),
			);
		}
		years = fullListing.filter((item: any) => {
			const isDir = item.type === "dir" || item.stat?.type === "dir";
			const isYear = !isNaN(parseInt(item.name)) && /^\d+$/.test(item.name);
			return isDir && isYear;
		});
		structuredLogger.debug(
			`[UpdateGroup] Filtered to ${years.length} year folders:`,
			years.map((y: any) => y.name),
		);
	} catch (err: any) {
		structuredLogger.error(err);
		recordGroupError(itemIndex, err);
		// Abort the process to prevent data corruption (writing empty files)
		return;
	}

	const recentCutoff =
		typeof recentDays === "number" && recentDays > 0
			? new Date(Date.now() - recentDays * 24 * 60 * 60 * 1000)
					.toISOString()
					.slice(0, 10)
			: null;
	const isRecentRefresh = Boolean(recentCutoff);
	const shouldReconcileMissingYears =
		isRecentRefresh || (reconcileMissingYears && updateAll && !targetSessionId);

	// Only an explicit full all-years refresh can treat missing year prefixes as
	// deletions. Recent refreshes reconcile only sessions inside their date window.
	if (shouldReconcileMissingYears) {
		const listedYears = new Set<string>(
			years.map((year: any) => String(year.name)),
		);
		let existingYears: string[] = [];
		let canReconcileMissingYears = true;

		if (isMerged || isBundled) {
			existingYears = existingSessions
				.map(getSessionYear)
				.filter((year: string | null): year is string => Boolean(year));
		} else {
			try {
				const localYearFiles = await getListing(
					makePath(LOCAL_SYNC_PATH, name),
					{ strict: true },
				);
				existingYears = localYearFiles
					.filter((file: any) => {
						const isDirectory =
							file.type === "dir" || file.stat?.type === "dir";
						return !isDirectory && /^\d{4}\.json$/.test(file.name || "");
					})
					.map((file: any) => file.name.slice(0, 4));
			} catch (err: any) {
				canReconcileMissingYears = false;
				structuredLogger.warn(
					`[UpdateGroup] Could not list local year indexes for ${name}; preserving absent years.`,
					err,
				);
			}
		}

		const missingYears = canReconcileMissingYears
			? Array.from(new Set(existingYears))
					.filter((year) => !listedYears.has(year))
					.sort()
			: [];
		if (missingYears.length > 0) {
			const missingYearSet = new Set(missingYears);
			addSyncLog(
				`[${name}] Reconciling sessions for years no longer present in S3: ${missingYears.join(", ")}.`,
				"info",
			);

			if (isMerged || isBundled) {
				let removedCount = 0;
				for (let index = allSessions.length - 1; index >= 0; index--) {
					const session = allSessions[index];
					const missingYear = missingYearSet.has(getSessionYear(session) || "");
					const isRemoved = isRecentRefresh
						? missingYear && !isOutsideRecentWindow(session, recentCutoff!)
						: missingYear;
					if (isRemoved) {
						allSessions.splice(index, 1);
						removedCount++;
					}
				}
				UpdateSessionsStore.update((s) => {
					s.status[itemIndex].removedCount += removedCount;
					s.status = [...s.status];
				});
			} else {
				for (const year of missingYears) {
					const previousSessions = await loadCachedYearSessions(
						name,
						year,
						false,
						false,
					);
					if (!previousSessions.length) continue;
					const remainingSessions = isRecentRefresh
						? previousSessions.filter((session: any) =>
								isOutsideRecentWindow(session, recentCutoff!),
							)
						: [];
					const removedCount =
						previousSessions.length - remainingSessions.length;
					if (removedCount === 0) continue;
					const result = await updateYearSync(
						name,
						year,
						remainingSessions,
						previousSessions,
					);
					if (!result?.counter) {
						const error = new Error(
							`Could not clear missing year index ${name}/${year}`,
						);
						recordGroupError(itemIndex, error);
						return;
					}
					UpdateSessionsStore.update((s) => {
						s.status[itemIndex].removedCount += removedCount;
						s.status = [...s.status];
					});
				}
			}
		}
	}
	if (
		updateAll &&
		!shouldReconcileMissingYears &&
		(isMerged || isBundled) &&
		existingSessions.length > 0
	) {
		const listedYears = new Set<string>(
			years.map((year: any) => String(year.name)),
		);
		const missingYears = [
			...new Set<string>(
				existingSessions
					.map(getSessionYear)
					.filter((year: string | null): year is string => Boolean(year)),
			),
		]
			.filter((year) => !listedYears.has(year))
			.sort();
		if (missingYears.length > 0) {
			const message =
				`[${name}] Remote year listing omitted locally stored years ` +
				`(${missingYears.join(", ")}). Preserving those sessions; run a complete full update to reconcile them.`;
			structuredLogger.warn(`[UpdateGroup] ${message}`);
			addSyncLog(message, "warning");
		}
	}

	if (recentCutoff) {
		const cutoffYear = recentCutoff.slice(0, 4);
		const currentYear = String(new Date().getFullYear());
		years = years.filter(
			(year: any) => year.name >= cutoffYear && year.name <= currentYear,
		);
	} else if (!updateAll) {
		const currentYear = new Date().getFullYear();
		years = years.filter((year: any) => {
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

	const promises = years.map((year: any) =>
		limit(() =>
			processGroupYear({
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
			}),
		),
	);
	try {
		await Promise.all(promises);
	} catch {
		structuredLogger.error(
			`[Sync] Group ${name} failed to process all years. Aborting write to prevent corruption.`,
		);
		return;
	}

	const persistence = await persistGroupSessions({
		name,
		isBundled,
		isMerged,
		existingSessions,
		forceUpdate,
		allSessions,
		allSessionNames,
		itemIndex,
		years,
	});
	if (!persistence.continue) return persistence.value;

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
		const sortedNew = newSessions.map((s: any) => s.name).sort();
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
