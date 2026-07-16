import { LOCAL_SYNC_PATH } from "../constants";
import { addSyncLog } from "../logs";

/**
 * Step: Report local files absent from the remote manifest.
 *
 * Remote-manifest absence is not a safe deletion signal: manifests can be
 * stale or incomplete, and deleting here runs before writable clients can
 * re-upload the local file. Explicit local deletions are handled by the
 * tombstone flow in deleteRemoteFiles instead.
 */
export async function removeDeletedFiles(
	localManifest,
	remoteManifest,
	localPath = LOCAL_SYNC_PATH,
	_readOnly = false,
) {
	addSyncLog("Checking for deleted files...", "info");

	try {
		// Safety check: If we didn't load from a manifest file, do not delete local files.
		// This prevents mass deletion when the remote folder is missing or inaccessible (e.g., failed listing).
		if (!remoteManifest.loadedFromManifest) {
			if (remoteManifest.length === 0) {
				addSyncLog(
					"Remote manifest missing/empty - skipping deletion for safety",
					"warning",
				);
			} else {
				addSyncLog(
					"Remote manifest generated from listing - skipping deletion for safety",
					"warning",
				);
			}
			return { manifest: localManifest, hasChanges: false };
		}

		const remotePathsSet = new Set((remoteManifest || []).map((f) => f.path));
		const absentFromRemote = localManifest.filter(
			(file) => !remotePathsSet.has(file.path),
		);

		if (absentFromRemote.length === 0) {
			addSyncLog("✓ No deleted files to remove", "info");
			return { manifest: localManifest, hasChanges: false };
		}

		addSyncLog(
			`Keeping ${absentFromRemote.length} local file(s) absent from the remote manifest for reconciliation`,
			"warning",
		);
		return { manifest: localManifest, hasChanges: false };
	} catch (err) {
		addSyncLog(`Remove deleted files failed: ${err.message}`, "error");
		throw err;
	}
}
