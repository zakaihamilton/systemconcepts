import { logger as structuredLogger } from "@util/api/logger";
import { addSyncLog } from "../../logs";

export function planDownloads(
	localManifest: any,
	remoteManifest: any,
	canUpload: boolean,
	restoreMissingFiles: boolean,
) {
	const localMap = new Map<string, any>(
		(localManifest || []).map((f: any) => [f.path, f]),
	);
	const toDownload: any[] = [];
	const updates: any[] = [];

	for (const remoteFile of remoteManifest) {
		if (remoteFile.deleted) continue;
		const localFile = localMap.get(remoteFile.path);
		const remoteVer = parseInt(remoteFile.version) || 0;
		const localVer = localFile ? parseInt(localFile.version) || 0 : 0;

		structuredLogger.debug(
			`[Sync] Check ${remoteFile.path}: remoteVer=${remoteVer}, localVer=${localVer}`,
		);

		if (remoteVer > localVer || !localFile) {
			if (localFile && localFile.hash === remoteFile.hash) {
				structuredLogger.debug(
					`[Sync] Hash matches for ${remoteFile.path} (${localFile.hash}). Updating local manifest version to ${remoteFile.version} without downloading.`,
				);
				addSyncLog(
					`Hash matches for ${remoteFile.path}. Version updated to ${remoteFile.version}.`,
					"info",
				);
				updates.push({
					...localFile,
					version: remoteFile.version,
				});
			} else {
				toDownload.push(remoteFile);
			}
		} else if (localFile.deleted) {
			if (canUpload && !restoreMissingFiles) {
				structuredLogger.debug(
					`[Sync] Skipping download for locally deleted file: ${remoteFile.path}`,
				);
			} else if (restoreMissingFiles) {
				structuredLogger.debug(
					`[Sync] Restoring missing/deleted file (Safety Policy): ${remoteFile.path}`,
				);
				addSyncLog(`Safety Restore: ${remoteFile.path}`, "warning");
				toDownload.push(remoteFile);
			} else {
				structuredLogger.debug(
					`[Sync] Restoring locally deleted file from remote: ${remoteFile.path}`,
				);
				toDownload.push(remoteFile);
			}
		}
	}

	return { localMap, toDownload, updates };
}

export function cleanMissingRemoteManifest(
	remoteManifest: any,
	missingOnRemote: any[],
	isStopping: boolean,
) {
	if (missingOnRemote.length === 0 || isStopping) {
		return remoteManifest;
	}

	addSyncLog(
		`Found ${missingOnRemote.length} missing file(s) on remote, cleaning manifest...`,
		"info",
	);

	const missingPaths = new Set(missingOnRemote.map((f: any) => f.path));
	const cleanedRemoteManifest = remoteManifest.filter(
		(f: any) => !missingPaths.has(f.path),
	);

	missingOnRemote.forEach((file: any) => {
		addSyncLog(
			`Removed from remote manifest: ${file.path} (file not found)`,
			"info",
		);
	});

	addSyncLog(
		"Remote manifest cleanup deferred because missing files make the phase incomplete",
		"warning",
	);

	return cleanedRemoteManifest;
}
