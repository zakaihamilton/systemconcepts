import { makePath } from "@util/data/path";

export async function findMissingManifestFiles(
	manifest: any,
	localPath: any,
	exists: any,
) {
	const missingFiles = [];
	for (const entry of manifest || []) {
		if (!entry?.path || entry.deleted) continue;
		if (!(await exists(makePath(localPath, entry.path)))) {
			missingFiles.push(entry.path);
		}
	}
	return missingFiles;
}
