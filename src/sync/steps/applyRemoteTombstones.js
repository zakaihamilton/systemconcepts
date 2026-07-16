import { makePath } from "@util/data/path";
import storage from "@util/storage/storage";
import { FILES_MANIFEST } from "../constants";
import { addSyncLog } from "../logs";
import { applyManifestUpdates } from "../manifest";
import { lockMutex } from "../mutex";
import { moveFileToTrash } from "../trash";

export async function applyRemoteTombstones(
	localManifest,
	remoteManifest,
	localPath,
	canUpload,
	syncId,
) {
	const localMap = new Map(localManifest.map((entry) => [entry.path, entry]));
	const candidates = remoteManifest.filter((remoteEntry) => {
		if (!remoteEntry.deleted) return false;
		const localEntry = localMap.get(remoteEntry.path);
		if (!localEntry) return true;
		if (
			localEntry.deleted &&
			(parseInt(localEntry.version) || 0) >=
				(parseInt(remoteEntry.version) || 0)
		) {
			return false;
		}
		if (!canUpload) return true;
		return (
			(parseInt(remoteEntry.version) || 0) >=
			(parseInt(localEntry.version) || 0)
		);
	});

	if (candidates.length === 0) {
		return {
			manifest: localManifest,
			complete: true,
			hasChanges: false,
			counts: { attempted: 0, succeeded: 0, failed: 0 },
		};
	}

	const updates = [];
	let failed = 0;
	for (const tombstone of candidates) {
		try {
			const result = await moveFileToTrash(localPath, syncId, tombstone.path);
			if (result.moved) {
				addSyncLog(`Moved to local trash: ${tombstone.path}`, "warning");
			}
			updates.push({ ...tombstone, deleted: true });
		} catch {
			failed++;
			addSyncLog(`Failed to move to local trash: ${tombstone.path}`, "error");
		}
	}

	const updatedManifest = await applyManifestUpdates(localManifest, updates);
	if (updates.length > 0) {
		const manifestPath = makePath(localPath, FILES_MANIFEST);
		const unlock = await lockMutex({ id: manifestPath });
		try {
			await storage.writeFile(
				manifestPath,
				JSON.stringify(updatedManifest, null, 4),
			);
		} finally {
			unlock();
		}
	}

	return {
		manifest: updatedManifest,
		complete: failed === 0,
		hasChanges: updates.length > 0,
		counts: {
			attempted: candidates.length,
			succeeded: updates.length,
			failed,
		},
	};
}
