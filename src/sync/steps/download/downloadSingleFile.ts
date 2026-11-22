import { logger as structuredLogger } from "@util/api/logger";
import { stringToBinary } from "@util/data/binary";
import { isBinaryFile, makePath } from "@util/data/path";
import storage from "@util/storage/storage";
import { readCompressedFileRaw } from "../../bundle";
import { addSyncLog } from "../../logs";
import { lockMutex } from "../../mutex";
import { createSyncTrashId, moveFolderToTrash } from "../../trash";
import {
	checkLocalConflict,
	resolveTextContentToWrite,
} from "./reconcileContent";

const LOCAL_WRITE_TIMEOUT_MS = 30_000;

function withTimeout(promise: any, ms: any, message: any) {
	let timeoutId: any;
	const timeout = new Promise((_, reject) => {
		timeoutId = setTimeout(() => reject(new Error(message)), ms);
	});
	return Promise.race([promise, timeout]).finally(() =>
		clearTimeout(timeoutId),
	);
}

async function writeLocalFile(
	localFilePath: any,
	contentToWrite: any,
	fileBasename: any,
) {
	addSyncLog(`[${fileBasename}] Writing local file…`, "verbose");
	await withTimeout(
		storage.writeFile(localFilePath, contentToWrite),
		LOCAL_WRITE_TIMEOUT_MS,
		`[${fileBasename}] Local write timed out after ${LOCAL_WRITE_TIMEOUT_MS / 1000}s`,
	);
	addSyncLog(`[${fileBasename}] Local file written.`, "verbose");
}

async function ensureLocalFolder(
	localFilePath: string,
	fileBasename: string,
	createdFolders: any,
) {
	if (createdFolders) {
		const folder = localFilePath.substring(0, localFilePath.lastIndexOf("/"));
		if (!createdFolders.has(folder)) {
			addSyncLog(`[${fileBasename}] Preparing local path…`, "verbose");
			await storage.createFolderPath(localFilePath);
			createdFolders.add(folder);
		}
	} else {
		await storage.createFolderPath(localFilePath);
	}
}

export async function downloadSingleFile(
	remoteFile: any,
	localEntry: any,
	createdFolders: any,
	localPath: any,
	remotePath: any,
) {
	const fileBasename = remoteFile.path;
	const localFilePath = makePath(localPath, fileBasename);
	const isBinary = isBinaryFile(localFilePath);

	let remoteFilePath = isBinary
		? makePath(remotePath, fileBasename)
		: makePath(remotePath, `${fileBasename}.gz`);

	try {
		let content;

		if (isBinary) {
			content = await storage.readFile(remoteFilePath);
			if (content === null) {
				remoteFilePath = makePath(remotePath, `${fileBasename}.gz`);
				content = await readCompressedFileRaw(remoteFilePath, { strict: true });
			}
		} else {
			content = await readCompressedFileRaw(remoteFilePath, { strict: true });
			if (content === null) {
				remoteFilePath = makePath(remotePath, fileBasename);
				content = await readCompressedFileRaw(remoteFilePath, { strict: true });
			}
		}

		if (content === null) return null;
		addSyncLog(
			`[${fileBasename}] Remote content ready (${Math.round((content.length || 0) / 1024)}KB).`,
			"verbose",
		);

		await ensureLocalFolder(localFilePath, fileBasename, createdFolders);

		if (isBinary) {
			const unlock = await lockMutex({ id: localFilePath });
			try {
				let binaryContent = content;
				if (typeof content === "string") {
					const blob = stringToBinary(content);
					binaryContent = new Uint8Array(await blob.arrayBuffer());
				}
				await writeLocalFile(localFilePath, binaryContent, fileBasename);
			} finally {
				unlock();
			}

			addSyncLog(`Downloaded: ${makePath(remotePath, fileBasename)}`, "info");
			return { ...remoteFile };
		}

		const { contentToWrite, finalHash, finalSize } =
			await resolveTextContentToWrite(content, remoteFile, fileBasename);

		const unlock = await lockMutex({ id: localFilePath });
		try {
			const conflictResult = await checkLocalConflict(
				localFilePath,
				fileBasename,
				localEntry,
				remoteFile,
			);
			if (conflictResult) {
				return conflictResult;
			}

			try {
				await writeLocalFile(localFilePath, contentToWrite, fileBasename);
			} catch (err: any) {
				const errorStr = (err.message || String(err)).toLowerCase();
				if (errorStr.includes("eisdir")) {
					structuredLogger.warn(
						`[Sync] Path ${localFilePath} is a directory, moving it to trash before writing the file.`,
					);
					await moveFolderToTrash(localPath, createSyncTrashId(), fileBasename);
					await writeLocalFile(localFilePath, contentToWrite, fileBasename);
					addSyncLog(`[${fileBasename}] Local path recovered.`, "verbose");
				} else {
					throw err;
				}
			}
		} finally {
			unlock();
		}

		addSyncLog(`Downloaded: ${makePath(remotePath, fileBasename)}`, "info");

		return {
			...remoteFile,
			hash: finalHash,
			size: finalSize,
		};
	} catch (err: any) {
		structuredLogger.error(`[Sync] Failed to download ${fileBasename}:`, err);
		addSyncLog(`Failed to download: ${fileBasename}`, "error");
		return { failed: true, path: remoteFile.path };
	}
}
