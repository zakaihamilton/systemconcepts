import { addSyncLog } from "@sync/logs";
import { UpdateSessionsStore } from "@sync/syncState";
import { logger as structuredLogger } from "@util/api/logger";
import pLimit from "@util/data/p-limit";
import { makePath } from "@util/data/path";
import { useCallback, useMemo } from "react";
import { updateGroupProcess } from "./updateGroup";
import { getListing, updateBundleFile } from "./utils";

async function runUpdateSessions(label, work) {
	UpdateSessionsStore.update((s) => {
		s.busy = true;
		s.start = new Date().getTime();
	});
	addSyncLog(`Update Sessions started (${label}).`, "info");
	try {
		const result = await work();
		addSyncLog(`Update Sessions finished (${label}).`, "success");
		return result;
	} catch (err) {
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

export function useUpdateSessions(groups) {
	const { busy, status, start } = UpdateSessionsStore.useState();
	const prefix = makePath("aws/sessions") + "/";

	const updateSessions = useCallback(
		async (includeDisabled) =>
			runUpdateSessions("current year", async () => {
				let items = [];
				try {
					items = await getListing(prefix);
				} catch (err) {
					structuredLogger.error(err);
				}
				if (!items) {
					return;
				}
				const limit = pLimit(4);
				const promises = items
					.map((item) => {
						const groupInfo = groups.find((group) => group.name === item.name);
						if (!groupInfo) {
							return null;
						}
						const isDisabled = groupInfo.disabled;
						const isMerged = groupInfo.merged ?? groupInfo.disabled;
						const isBundled = groupInfo.bundled;
						if (!includeDisabled && isDisabled) {
							return null;
						}
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
				const bundledSessions = results
					.filter((r) => r && Array.isArray(r))
					.flat();
				if (bundledSessions.length > 0) {
					await updateBundleFile(bundledSessions);
				}
				return results;
			}),
		[groups, prefix],
	);

	const updateAllSessions = useCallback(
		async (includeDisabled) =>
			runUpdateSessions("all years", async () => {
				let items = [];
				try {
					items = await getListing(prefix);
				} catch (err) {
					structuredLogger.error(err);
				}
				if (!items) {
					return;
				}
				const limit = pLimit(4);
				const promises = items
					.map((item) => {
						const groupInfo = groups.find((group) => group.name === item.name);
						if (!groupInfo) {
							return null;
						}
						const isDisabled = groupInfo.disabled;
						const isMerged = groupInfo.merged ?? groupInfo?.disabled;
						const isBundled = groupInfo.bundled;
						if (!includeDisabled && isDisabled) {
							return null;
						}
						return limit(() =>
							updateGroupProcess(item.name, true, true, isMerged, isBundled),
						);
					})
					.filter(Boolean);
				addSyncLog(
					`Updating ${promises.length} group(s) for all years…`,
					"info",
				);
				const results = await Promise.all(promises);
				const bundledSessions = results
					.filter((r) => r && Array.isArray(r))
					.flat();
				if (bundledSessions.length > 0) {
					await updateBundleFile(bundledSessions);
				}
				return results;
			}),
		[groups, prefix],
	);

	const updateAllMetadataCurrentYear = useCallback(
		async (includeDisabled) =>
			runUpdateSessions("metadata (current year)", async () => {
				let items = [];
				try {
					items = await getListing(prefix);
				} catch (err) {
					structuredLogger.error(err);
				}
				if (!items) {
					return;
				}
				const limit = pLimit(4);
				const promises = items
					.map((item) => {
						const groupInfo = groups.find((group) => group.name === item.name);
						if (!groupInfo) {
							return null;
						}
						const isDisabled = groupInfo.disabled;
						const isMerged = groupInfo.merged ?? groupInfo?.disabled;
						const isBundled = groupInfo.bundled;
						if (!includeDisabled && isDisabled) {
							return null;
						}
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
				const bundledSessions = results
					.filter((r) => r && Array.isArray(r))
					.flat();
				if (bundledSessions.length > 0) {
					await updateBundleFile(bundledSessions);
				}
				return results;
			}),
		[groups, prefix],
	);

	const updateRecentSessions = useCallback(
		async (includeDisabled) =>
			runUpdateSessions("recent (30 days)", async () => {
				let items = [];
				try {
					items = await getListing(prefix);
				} catch (err) {
					structuredLogger.error(err);
				}
				if (!items) return;

				const limit = pLimit(4);
				const groupPromises = items
					.map((item) => {
						const groupInfo = groups.find((group) => group.name === item.name);
						if (!groupInfo || (!includeDisabled && groupInfo.disabled)) {
							return null;
						}
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
				const bundledSessions = results
					.filter((result) => Array.isArray(result))
					.flat();
				if (bundledSessions.length > 0) {
					await updateBundleFile(bundledSessions);
				}
				return results;
			}),
		[groups, prefix],
	);

	const updateSpecificGroup = useCallback(
		async (name, updateAll, forceUpdate, targetSessionId = null) =>
			runUpdateSessions(`group ${name}`, async () => {
				const groupInfo = groups.find((g) => g.name === name);
				const isMerged = groupInfo?.merged ?? groupInfo?.disabled;
				const isBundled = groupInfo?.bundled;
				const result = await updateGroupProcess(
					name,
					updateAll,
					forceUpdate,
					isMerged,
					isBundled,
					targetSessionId,
				);
				if (isBundled && Array.isArray(result) && result.length > 0) {
					await updateBundleFile(result);
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
