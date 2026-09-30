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
	getSessionYear,
} from "./updateGroupYearMetadata";
import { getListing } from "./utils";

const prefix = "wasabi/";
export async function updateGroupProcess(
	name: any,
	updateAll: any,
	forceUpdate = false,
	isMerged = false,
	isBundled = false,
	targetSessionId: string | null = null,
	recentDays: number | null = null,
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

	if (updateAll && (isMerged || isBundled) && existingSessions.length > 0) {
		const listedYears = new Set(years.map((year: any) => String(year.name)));
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
