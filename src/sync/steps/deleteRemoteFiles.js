import { logger as structuredLogger } from "@util/api/logger";
import { addSyncLog } from "../logs";
import { moveFileToTrash } from "../trash";

/**
 * Move remote files with committed tombstones into recoverable trash.
 * @param {Array} localManifest - The local manifest
 * @param {string} remotePath - The remote path to sync to
 * @returns {Promise<Object>} Structured move result
 */
export async function deleteRemoteFiles(localManifest, remotePath, syncId) {
	const start = performance.now();
	const toDelete = localManifest.filter((f) => f.deleted);

	if (toDelete.length === 0) {
		return {
			complete: true,
			movedPaths: [],
			counts: { attempted: 0, succeeded: 0, failed: 0 },
		};
	}

	addSyncLog(
		`Moving ${toDelete.length} deleted file(s) to remote trash...`,
		"info",
	);
	const movedPaths = [];
	let failed = 0;

	for (const file of toDelete) {
		try {
			const original = await moveFileToTrash(remotePath, syncId, file.path);
			const compressed = await moveFileToTrash(
				remotePath,
				syncId,
				`${file.path}.gz`,
			);
			if (original.moved || compressed.moved) {
				addSyncLog(`Moved to remote trash: ${file.path}`, "info");
			}
			movedPaths.push(file.path);
		} catch (err) {
			failed++;
			structuredLogger.error(
				`[Sync] Failed to move remote file ${file.path} to trash:`,
				err,
			);
			addSyncLog(`Failed to move to remote trash: ${file.path}`, "error");
		}
	}

	const duration = ((performance.now() - start) / 1000).toFixed(1);
	if (movedPaths.length > 0) {
		addSyncLog(
			`✓ Moved ${movedPaths.length} file(s) to remote trash in ${duration}s`,
			"success",
		);
	}

	return {
		complete: failed === 0,
		movedPaths,
		counts: {
			attempted: toDelete.length,
			succeeded: movedPaths.length,
			failed,
		},
	};
}
