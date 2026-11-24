import { makePath } from "@util/data/path";
import { FILES_MANIFEST } from "./constants";
import type { PipelineDependencies } from "./pipelineTypes";
import { readFileIfExists } from "./storageReads";
import type { Manifest, SyncConfig } from "./types";

export async function getLibraryLocalFiles(
	localPath: string,
	config: SyncConfig,
	dependencies: PipelineDependencies,
) {
	if (!config.useChangeCounter) {
		return {
			localFiles: await dependencies.getLocalFiles(localPath, config),
			skipHashing: false,
		};
	}
	const counter = await dependencies.readLibraryCounter();
	const savedCounter = dependencies.getSavedLibraryCounter();
	const manifestPath = makePath(localPath, FILES_MANIFEST);
	let cachedManifest: Manifest | null = null;
	try {
		const content = await readFileIfExists(dependencies.storage, manifestPath);
		if (content !== null) {
			const parsed: unknown = content ? JSON.parse(content) : [];
			if (
				Array.isArray(parsed) &&
				parsed.every(
					(entry: unknown) =>
						typeof entry === "object" &&
						entry !== null &&
						"path" in entry &&
						typeof entry.path === "string",
				)
			) {
				cachedManifest = parsed as Manifest;
			}
		}
	} catch (error) {
		dependencies.logger.warn(
			"[Sync] Failed to read cached local manifest:",
			error,
		);
	}
	if (cachedManifest && savedCounter === counter) {
		dependencies.addSyncLog(
			`Library counter unchanged (${counter}); skipping local library scan`,
			"info",
		);
		return {
			localFiles: cachedManifest
				.filter((entry) => !entry.deleted)
				.map((entry) => ({
					path: entry.path,
					fullPath: makePath(localPath, entry.path),
				})),
			libraryCounter: counter,
			skipHashing: true,
		};
	}
	if (savedCounter !== null) {
		dependencies.addSyncLog(
			`Library counter changed (${savedCounter} -> ${counter}); checking library files`,
			"info",
		);
	}
	return {
		localFiles: await dependencies.getLocalFiles(localPath, config),
		libraryCounter: counter,
		skipHashing: false,
	};
}
