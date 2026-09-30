import { writeCompressedFile } from "@sync/bundle";
import {
	FILES_MANIFEST,
	LOCAL_SYNC_PATH,
	SYNC_BASE_PATH,
} from "@sync/constants";
import { getFileInfo } from "@sync/hash";
import { updateManifestEntry } from "@sync/manifest";
import { addSyncLog } from "@sync/sync";
import { UpdateSessionsStore } from "@sync/syncState";
import { logger as structuredLogger } from "@util/api/logger";
import { makePath } from "@util/data/path";
import storage from "@util/storage/storage";
import { cleanupBundledGroup, cleanupMergedGroup } from "./cleanup";
import { toSessionProgress } from "./sessionProgress";
import { updateYearSync, yieldToMain } from "./utils";

type GroupSession = import("../../../types/domain").Session & {
	files?: string[];
};

export async function persistGroupSessions({
	name,
	isBundled,
	isMerged,
	existingSessions,
	forceUpdate,
	allSessions,
	allSessionNames,
	itemIndex,
	years,
}: {
	name: string;
	isBundled: boolean;
	isMerged: boolean;
	existingSessions: GroupSession[];
	forceUpdate: boolean;
	allSessions: GroupSession[];
	allSessionNames: Set<string>;
	itemIndex: number;
	years: { name: string }[];
}) {
	if (isBundled || isMerged) {
		// Fresh sessions overlay cached entries by ID for either compact format.
		const uniqueSessions = [
			...new Map(allSessions.map((session) => [session.id, session])).values(),
		].sort((a, b) => a.id.localeCompare(b.id));
		existingSessions.sort((a, b) => a.id.localeCompare(b.id));
		if (
			!forceUpdate &&
			JSON.stringify(uniqueSessions) === JSON.stringify(existingSessions)
		) {
			addSyncLog(`[${name}] ✓ Verified (no changes).`, "success");
			return {
				continue: false,
				...(isBundled ? { value: uniqueSessions } : {}),
			};
		}
		if (isBundled) {
			await cleanupBundledGroup(name);
		} else {
			// 2. Write ONE merged file (compact JSON — pretty-print freezes large groups)
			const localGroupPath = makePath(LOCAL_SYNC_PATH, `${name}.json`);
			const groupData = {
				version: 1,
				group: name,
				date: Date.now(),
				sessions: uniqueSessions,
			};
			await yieldToMain();
			const jsonString = JSON.stringify(groupData);
			await writeCompressedFile(localGroupPath, jsonString);

			// Update local manifest immediately so useSessions can see it
			try {
				const info = await getFileInfo(jsonString);
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
			} catch (err: any) {
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
				...newSessionItems.map(toSessionProgress),
			);
			s.status = [...s.status];
		});
		uniqueSessions.forEach((session) => allSessionNames.add(session.id));
		if (isBundled) return { continue: false, value: uniqueSessions };
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
					const byYear: Record<string, any> = {};
					data.sessions.forEach((s: any) => {
						if (!byYear[s.year]) byYear[s.year] = [];
						byYear[s.year].push(s);
					});

					// Write year files for years NOT processed in this sync
					// (Processed years are already written by updateYearSync above)
					const processedYears = new Set(years.map((y: any) => y.name));
					for (const [year, sessions] of Object.entries(byYear)) {
						if (!processedYears.has(year)) {
							await updateYearSync(name, year, sessions);
						}
					}
				}
			} catch (err: any) {
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
			} catch (err: any) {
				structuredLogger.error(
					`[Sync] Error deleting remote merged file for ${name}:`,
					err,
				);
			}
		}
	}

	return { continue: true };
}
