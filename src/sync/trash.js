import { makePath } from "@util/data/path";
import storage from "@util/storage/storage";
import { isMissingFileError } from "./storageReads";

export function createSyncTrashId() {
	return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function getTrashPath(rootPath, syncId, filePath) {
	return makePath(rootPath, ".sync-trash", syncId, filePath);
}

export async function moveFileToTrash(rootPath, syncId, filePath) {
	const sourcePath = makePath(rootPath, filePath);
	const trashPath = getTrashPath(rootPath, syncId, filePath);
	try {
		await storage.createFolderPath(trashPath);
		await storage.moveFile(sourcePath, trashPath);
		return { moved: true, missing: false, sourcePath, trashPath };
	} catch (error) {
		if (isMissingFileError(error)) {
			return { moved: false, missing: true, sourcePath, trashPath };
		}
		throw error;
	}
}

export async function moveFolderToTrash(rootPath, syncId, folderPath) {
	const sourcePath = makePath(rootPath, folderPath);
	const trashPath = getTrashPath(rootPath, syncId, folderPath);
	try {
		await storage.createFolderPath(trashPath, true);
		await storage.moveFolder(sourcePath, trashPath);
		return { moved: true, missing: false, sourcePath, trashPath };
	} catch (error) {
		if (isMissingFileError(error)) {
			return { moved: false, missing: true, sourcePath, trashPath };
		}
		throw error;
	}
}
