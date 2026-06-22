// @ts-check

import { logger as structuredLogger } from "@util/api/logger";
import { makePath } from "@util/data/path";
import storage from "@util/storage/storage";
import { readCompressedFile } from "./bundle";
import { FILES_MANIFEST_GZ } from "./constants";
import { findMissingManifestFiles } from "./freshness";
import { addSyncLog } from "./logs";
import { getUserSyncStorageKey } from "./userStorage";

/**
 * @param {import("./types").Manifest} manifest
 */
export function getManifestSignature(manifest) {
	if (!Array.isArray(manifest)) return "";
	return JSON.stringify(
		manifest.map(({ path, modified, version, hash }) => [
			path,
			modified,
			version,
			hash,
		]),
	);
}

/**
 * @param {object} [dependencies]
 * @param {typeof readCompressedFile} [dependencies.readManifest]
 * @param {typeof storage} [dependencies.storageAdapter]
 * @param {typeof findMissingManifestFiles} [dependencies.findMissingFiles]
 * @param {typeof addSyncLog} [dependencies.log]
 * @param {typeof structuredLogger} [dependencies.logger]
 */
export function createFreshnessService({
	readManifest = readCompressedFile,
	storageAdapter = storage,
	findMissingFiles = findMissingManifestFiles,
	log = addSyncLog,
	logger = structuredLogger,
} = {}) {
	return {
		/**
		 * @param {import("./types").SyncConfig} config
		 * @param {string} userId
		 * @returns {Promise<import("./types").ManifestFreshness | null>}
		 */
		async getReadOnlyManifestFreshness(config, userId) {
			if (typeof window === "undefined" || config.migration) return null;
			const resolvedRemotePath = config.remotePath.replace("{userid}", userId);
			const manifestPath = makePath(resolvedRemotePath, FILES_MANIFEST_GZ);
			const storageKey = getUserSyncStorageKey(
				`sync_manifest_signature:${resolvedRemotePath}`,
				userId,
			);
			if (!storageKey) return null;
			try {
				const rawManifest = await readManifest(manifestPath);
				if (!Array.isArray(rawManifest) || !rawManifest.length) return null;
				/** @type {import("./types").Manifest} */
				const manifest = rawManifest;
				const signature = getManifestSignature(manifest);
				const previousSignature = localStorage.getItem(storageKey);
				const missingLocalFiles =
					previousSignature === signature
						? await findMissingFiles(
								manifest,
								config.localPath,
								(/** @type {string} */ path) =>
									/** @type {any} */ (storageAdapter).exists(path),
							)
						: [];
				const fresh =
					previousSignature === signature && missingLocalFiles.length === 0;
				if (missingLocalFiles.length > 0) {
					log(
						`${config.name} manifest is unchanged but ${missingLocalFiles.length} local file(s) are missing; repairing`,
						"warning",
					);
					logger.warn(
						`[Sync] ${config.name} local integrity check found missing files:`,
						missingLocalFiles,
					);
				}
				return { fresh, signature, storageKey, missingLocalFiles };
			} catch (error) {
				const message = error instanceof Error ? error.message : error;
				logger.warn(
					`[Sync] Manifest freshness check failed for ${resolvedRemotePath}:`,
					message,
				);
				return null;
			}
		},
		/**
		 * @param {import("./types").ManifestFreshness | null} freshness
		 */
		persistManifestSignature(freshness) {
			if (typeof window !== "undefined" && freshness?.storageKey) {
				localStorage.setItem(freshness.storageKey, freshness.signature);
			}
		},
	};
}

const freshnessService = createFreshnessService();

export const getReadOnlyManifestFreshness =
	freshnessService.getReadOnlyManifestFreshness;
export const persistManifestSignature =
	freshnessService.persistManifestSignature;
