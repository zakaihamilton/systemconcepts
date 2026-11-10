import { addSyncLog } from "@sync/logs";
import { SyncActiveStore, UpdateSessionsStore } from "@sync/syncState";
import { logger as structuredLogger } from "@util/api/logger";
import pLimit from "@util/data/p-limit";
import { makePath } from "@util/data/path";
import { useCallback, useMemo } from "react";
import { updateGroupProcess } from "./updateGroup";
import { getListing, updateBundleFile } from "./utils";

async function persistBundledUpdates(tasks: any[], results: any[]) {
	const updates = tasks.flatMap((task, index) => {
		const sessions = results[index];
		return task.isBundled && Array.isArray(sessions)
			? [{ groupName: task.name, sessions }]
			: [];
	});
	if (updates.length === 0) return;

	const sessions = updates.flatMap((update: any) => update.sessions);
	if (updates.some((update: any) => update.sessions.length === 0)) {
		await updateBundleFile(
			sessions,
			updates.map((update: any) => update.groupName),
		);
	} else {
		await updateBundleFile(sessions);
	}
}

async function runUpdateSessions(label: any, work: any) {
	UpdateSessionsStore.update((s) => {
		s.busy = true;
		s.start = new Date().getTime();
	});
	addSyncLog(`Update Sessions started (${label}).`, "info");
	try {
		const result = await work();
		SyncActiveStore.update((s) => {
			s.needsSessionReload = true;
		});
		addSyncLog(`Update Sessions finished (${label}).`, "success");
		return result;
	} catch (err: any) {
		addSyncLog(
			`Update Sessions failed (${label}): ${err.message || err}`,
			"error",
		);
		throw err;
	} finally {
		UpdateSessionsStore.update((s) => {
			s.busy = false;
		});
	}
}

export function useUpdateSessions(groups: any) {
	const { busy, status, start } = UpdateSessionsStore.useState();
	const prefix = makePath("aws/sessions") + "/";

	const updateSessions = useCallback(
		async (includeDisabled: any) =>
			runUpdateSessions("current year", async () => {
				let items = [];
				try {
					items = await getListing(prefix);
				} catch (err: any) {
					structuredLogger.error(err);
				}
				if (!items) {
					return;
				}
				const limit = pLimit(4);
				const tasks: any[] = [];
				const promises = items
					.map((item: any) => {
						const groupInfo = groups.find(
							(group: any) => group.name === item.name,
						);
						if (!groupInfo) {
							return null;
						}
						const isDisabled = groupInfo.disabled;
						const isMerged = groupInfo.merged ?? groupInfo.disabled;
						const isBundled = groupInfo.bundled;
						if (!includeDisabled && isDisabled) {
							return null;
						}
						tasks.push({ name: item.name, isBundled });
						return limit(() =>
							updateGroupProcess(item.name, false, false, isMerged, isBundled),
						);
					})
					.filter(Boolean);
				addSyncLog(
					`Updating ${promises.length} group(s) for current year…`,
					"info",
				);
				const results = await Promise.all(promises);
				await persistBundledUpdates(tasks, results);
				return results;
			}),
		[groups, prefix],
	);

	const updateAllSessions = useCallback(
		async (includeDisabled: any) =>
			runUpdateSessions("all years", async () => {
				let items = [];
				try {
					items = await getListing(prefix);
				} catch (err: any) {
					structuredLogger.error(err);
				}
				if (!items) {
					return;
				}
				const limit = pLimit(4);
				const tasks: any[] = [];
				const promises = items
					.map((item: any) => {
						const groupInfo = groups.find(
							(group: any) => group.name === item.name,
						);
						if (!groupInfo) {
							return null;
						}
						const isDisabled = groupInfo.disabled;
						const isMerged = groupInfo.merged ?? groupInfo?.disabled;
						const isBundled = groupInfo.bundled;
						if (!includeDisabled && isDisabled) {
							return null;
						}
						tasks.push({ name: item.name, isBundled });
						return limit(() =>
							updateGroupProcess(
								item.name,
								true,
								true,
								isMerged,
								isBundled,
								null,
								null,
								true,
							),
						);
					})
					.filter(Boolean);
				addSyncLog(
					`Updating ${promises.length} group(s) for all years…`,
					"info",
				);
				const results = await Promise.all(promises);
				await persistBundledUpdates(tasks, results);
				return results;
			}),
		[groups, prefix],
	);

	const updateAllMetadataCurrentYear = useCallback(
		async (includeDisabled: any) =>
			runUpdateSessions("metadata (current year)", async () => {
				let items = [];
				try {
					items = await getListing(prefix);
				} catch (err: any) {
					structuredLogger.error(err);
				}
				if (!items) {
					return;
				}
				const limit = pLimit(4);
				const tasks: any[] = [];
				const promises = items
					.map((item: any) => {
						const groupInfo = groups.find(
							(group: any) => group.name === item.name,
						);
						if (!groupInfo) {
							return null;
						}
						const isDisabled = groupInfo.disabled;
						const isMerged = groupInfo.merged ?? groupInfo?.disabled;
						const isBundled = groupInfo.bundled;
						if (!includeDisabled && isDisabled) {
							return null;
						}
						tasks.push({ name: item.name, isBundled });
						return limit(() =>
							updateGroupProcess(item.name, false, true, isMerged, isBundled),
						);
					})
					.filter(Boolean);
				addSyncLog(
					`Updating ${promises.length} group(s) for metadata (current year)…`,
					"info",
				);
				const results = await Promise.all(promises);
				await persistBundledUpdates(tasks, results);
				return results;
			}),
		[groups, prefix],
	);

	const updateRecentSessions = useCallback(
		async (includeDisabled: any) =>
			runUpdateSessions("recent (30 days)", async () => {
				let items = [];
				try {
					items = await getListing(prefix);
				} catch (err: any) {
					structuredLogger.error(err);
				}
				if (!items) return;

				const limit = pLimit(4);
				const tasks: any[] = [];
				const groupPromises = items
					.map((item: any) => {
						const groupInfo = groups.find(
							(group: any) => group.name === item.name,
						);
						if (!groupInfo || (!includeDisabled && groupInfo.disabled)) {
							return null;
						}
						tasks.push({ name: item.name, isBundled: groupInfo.bundled });
						return limit(() =>
							updateGroupProcess(
								item.name,
								false,
								true,
								groupInfo.merged ?? groupInfo.disabled,
								groupInfo.bundled,
								null,
								30,
							),
						);
					})
					.filter(Boolean);
				addSyncLog(
					`Updating ${groupPromises.length} group(s) for recent (30 days)…`,
					"info",
				);
				const results = await Promise.all(groupPromises);
				await persistBundledUpdates(tasks, results);
				return results;
			}),
		[groups, prefix],
	);

	const updateSpecificGroup = useCallback(
		async (
			name: any,
			updateAll: any,
			forceUpdate: any,
			targetSessionId = null,
		) =>
			runUpdateSessions(`group ${name}`, async () => {
				const groupInfo = groups.find((g: any) => g.name === name);
				const isMerged = groupInfo?.merged ?? groupInfo?.disabled;
				const isBundled = groupInfo?.bundled;
				const reconcileMissingYears = Boolean(updateAll && !targetSessionId);
				const result = reconcileMissingYears
					? await updateGroupProcess(
							name,
							updateAll,
							forceUpdate,
							isMerged,
							isBundled,
							targetSessionId,
							null,
							true,
						)
					: await updateGroupProcess(
							name,
							updateAll,
							forceUpdate,
							isMerged,
							isBundled,
							targetSessionId,
						);
				if (isBundled && Array.isArray(result)) {
					if (result.length === 0) {
						await updateBundleFile(result, [name]);
					} else {
						await updateBundleFile(result);
					}
				}
				return result;
			}),
		[groups],
	);

	return useMemo(
		() => ({
			status,
			busy,
			start,
			updateSessions: !busy && updateSessions,
			updateAllSessions: !busy && updateAllSessions,
			updateAllMetadataCurrentYear: !busy && updateAllMetadataCurrentYear,
			updateRecentSessions: !busy && updateRecentSessions,
			updateGroup: !busy && updateSpecificGroup,
		}),
		[
			status,
			busy,
			start,
			updateSessions,
			updateAllSessions,
			updateAllMetadataCurrentYear,
			updateRecentSessions,
			updateSpecificGroup,
		],
	);
}
