import { logger as structuredLogger } from "@util/api/logger";
import storage from "@util/storage/storage";
import { getFileInfo } from "../../hash";
import { addSyncLog } from "../../logs";

export async function resolveTextContentToWrite(
	content: string,
	remoteFile: any,
	fileBasename: string,
) {
	let contentToWrite = content;
	const rawInfo = await getFileInfo(content);
	let finalHash = rawInfo.hash;
	let finalSize = rawInfo.size;

	let prettyContent: string | null = null;
	let prettyInfo: Awaited<ReturnType<typeof getFileInfo>> | null = null;

	if (content.length < 500 * 1024) {
		try {
			const obj = JSON.parse(content);
			prettyContent = JSON.stringify(obj, null, 4);
			prettyInfo = await getFileInfo(prettyContent);
		} catch {
			// Ignore parse errors
		}
	}

	if (remoteFile.hash) {
		if (rawInfo.hash === remoteFile.hash) {
			addSyncLog(
				`${fileBasename}: Matches RAW remote hash (${remoteFile.hash}). Writing raw.`,
				"verbose",
			);
			contentToWrite = content;
			finalHash = rawInfo.hash;
			finalSize = rawInfo.size;
		} else if (prettyInfo && prettyInfo.hash === remoteFile.hash) {
			addSyncLog(
				`${fileBasename}: Matches PRETTY remote hash (${remoteFile.hash}). Writing pretty-printed.`,
				"verbose",
			);
			contentToWrite = prettyContent!;
			finalHash = prettyInfo.hash;
			finalSize = prettyInfo.size;
		} else {
			structuredLogger.warn(
				`[Sync] Hash mismatch for ${fileBasename}. Remote: ${remoteFile.hash}, Raw: ${rawInfo.hash}, Pretty: ${prettyInfo?.hash}`,
			);
			if (prettyInfo) {
				contentToWrite = prettyContent!;
				finalHash = prettyInfo.hash;
				finalSize = prettyInfo.size;
			}
		}
	} else if (prettyInfo) {
		addSyncLog(
			`${fileBasename}: No remote hash. Defaulting to pretty-printed.`,
			"verbose",
		);
		contentToWrite = prettyContent!;
		finalHash = prettyInfo.hash;
		finalSize = prettyInfo.size;
	}

	return { contentToWrite, finalHash, finalSize };
}

export async function checkLocalConflict(
	localFilePath: string,
	fileBasename: string,
	localEntry: any,
	remoteFile: any,
) {
	if (!(await storage.exists(localFilePath))) {
		return null;
	}

	const currentContent = await storage.readFile(localFilePath);
	if (!currentContent) {
		return null;
	}

	const info = await getFileInfo(currentContent);
	if (localEntry && info.hash !== localEntry.hash) {
		structuredLogger.warn(`[Sync] Conflict detected for ${fileBasename}:`);
		structuredLogger.warn(`  - File exists locally and in manifest`);
		structuredLogger.warn(
			`  - Hash mismatch: manifest=${localEntry.hash}, current=${info.hash}`,
		);

		const remoteVer = parseInt(remoteFile.version) || 0;
		const localVer = parseInt(localEntry.version) || 0;
		const newVer = Math.max(remoteVer, localVer) + 1;

		addSyncLog(
			`Conflict resolved: ${fileBasename} (local version bumped to ${newVer})`,
			"warning",
		);

		return {
			path: remoteFile.path,
			hash: info.hash,
			size: info.size,
			version: newVer.toString(),
		};
	}

	return null;
}
