import { FILES_MANIFEST, LOCAL_SYNC_PATH } from "@sync/constants";
import { getFileInfo } from "@sync/hash";
import { addSyncLog } from "@sync/logs";
import { applyManifestUpdates } from "@sync/manifest";
import { makePath } from "@util/data/path";
import storage from "@util/storage/storage";

const COMPACTION_VERSION = 1;
const MARKER_PATH = makePath("local/session-thumbnail-compaction.json");

function isSessionFile(entry) {
	return (
		entry?.path &&
		entry.path.endsWith(".json") &&
		entry.path !== "/files.json" &&
		!entry.path.includes("/.group-update-cache/")
	);
}

function manifestSignature(manifest) {
	return (manifest || [])
		.filter(isSessionFile)
		.map((entry) => `${entry.path}:${entry.hash || ""}:${entry.version || ""}`)
		.sort()
		.join("|");
}

function removeLegacyThumbnails(data) {
	if (!Array.isArray(data?.sessions)) return false;
	let changed = false;
	for (const session of data.sessions) {
		if (
			typeof session?.thumbnail === "string" &&
			session.thumbnail.startsWith("data:image/")
		) {
			delete session.thumbnail;
			changed = true;
		}
	}
	return changed;
}

async function readJson(path) {
	const content = await storage.readFile(path);
	if (!content) return null;
	return JSON.parse(content);
}

/**
 * Remove legacy base64 thumbnails from synced session records without changing
 * their versions. Keeping the version aligned with the remote manifest makes
 * this a local cache compaction rather than an uploadable content change.
 */
export async function compactLegacySessionThumbnails() {
	const manifestPath = makePath(LOCAL_SYNC_PATH, FILES_MANIFEST);
	let manifest = [];
	try {
		manifest = (await readJson(manifestPath)) || [];
	} catch {
		return { compacted: 0, skipped: true };
	}
	if (!Array.isArray(manifest)) return { compacted: 0, skipped: true };

	const signature = manifestSignature(manifest);
	try {
		const marker = await readJson(MARKER_PATH);
		if (
			marker?.version === COMPACTION_VERSION &&
			marker.manifestSignature === signature
		) {
			return { compacted: 0, skipped: true };
		}
	} catch {
		// A missing or corrupt marker simply causes a safe rescan.
	}

	const updates = [];
	let compacted = 0;
	let failures = 0;
	for (const entry of manifest.filter(isSessionFile)) {
		const localPath = makePath(LOCAL_SYNC_PATH, entry.path);
		try {
			const data = await readJson(localPath);
			if (!removeLegacyThumbnails(data)) continue;

			const content = JSON.stringify(data, null, 4);
			await storage.writeFile(localPath, content);
			const info = await getFileInfo(content);
			updates.push({
				...entry,
				hash: info.hash,
				size: info.size,
			});
			compacted++;
		} catch {
			// An unreadable cache file is left untouched and will be retried later.
			failures++;
		}
	}

	const updatedManifest = await applyManifestUpdates(manifest, updates);
	if (updates.length > 0) {
		await storage.writeFile(
			manifestPath,
			JSON.stringify(updatedManifest, null, 4),
		);
		addSyncLog(
			`Compacted legacy thumbnails in ${compacted} local session file(s).`,
			"info",
		);
	}

	if (failures === 0) {
		await storage.createFolderPath(MARKER_PATH);
		await storage.writeFile(
			MARKER_PATH,
			JSON.stringify({
				version: COMPACTION_VERSION,
				manifestSignature: manifestSignature(updatedManifest),
			}),
		);
	} else {
		addSyncLog(
			`Legacy thumbnail compaction will retry ${failures} unreadable session file(s).`,
			"warning",
		);
	}

	return { compacted, skipped: false };
}

export const __test__ = { manifestSignature, removeLegacyThumbnails };
