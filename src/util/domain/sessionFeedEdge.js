import { logger as structuredLogger } from "@util/api/logger";
/**
 * Edge-compatible session feed utilities.
 * Mirrors the API of sessionFeed.js but uses only Web Platform APIs:
 *   - downloadDataEdge() instead of downloadData() (no @aws-sdk)
 *   - TextEncoder/btoa instead of Buffer
 *   - No metadataInfo / HeadObject calls
 *
 * Only export what is needed by the Edge RSS route.
 * All other callers should continue to use sessionFeed.js.
 */

import pLimit from "@util/data/p-limit";
import { downloadDataEdge } from "@util/storage/awsFetch";
import pako from "pako";

const MANIFEST_PATH = "sync/files.json.gz";
const CACHE_TTL_MS = 5 * 60 * 1000;
const decoder = new TextDecoder("utf-8");
const cache = new Map();

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function decodeData(data) {
	try {
		return decoder.decode(pako.inflate(data));
	} catch (_err) {
		// Not gzip-compressed — decode raw bytes as UTF-8
		return decoder.decode(
			data instanceof Uint8Array ? data : new Uint8Array(data),
		);
	}
}

async function getJsonFile(path) {
	const now = Date.now();
	const cached = cache.get(path);
	if (cached && cached.expiresAt > now) return cached.promise;

	const promise = downloadDataEdge({ path, binary: true }).then((data) =>
		JSON.parse(decodeData(data)),
	);
	cache.set(path, { expiresAt: now + CACHE_TTL_MS, promise });

	try {
		return await promise;
	} catch (err) {
		cache.delete(path);
		throw err;
	}
}

function matchesGroup(filePath, group) {
	if (!group) return true;
	const lowerGroup = group.toLowerCase().trim();
	const lowerPath = filePath.toLowerCase();
	return (
		filePath === "/bundle.json" ||
		lowerPath === `/${lowerGroup}.json` ||
		lowerPath.startsWith(`/${lowerGroup}/`)
	);
}

function normalizeProxyPath(path) {
	return path.replace(/^\//, "").replace(/^aws\//, "");
}

/**
 * Edge-compatible base64url encoding (no Buffer).
 * Encodes the string as UTF-8 then base64url.
 */
function encodeBase64Url(str) {
	const bytes = new TextEncoder().encode(str);
	const binStr = Array.from(bytes, (b) => String.fromCharCode(b)).join("");
	return btoa(binStr).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function getMediaPath(session) {
	if (session.audio?.path) return session.audio.path;
	if (session.video?.path) return session.video.path;

	const resolutions = session.resolutions || {};
	for (const resolution of Object.keys(resolutions)) {
		if (resolutions[resolution]?.path) {
			return resolutions[resolution].path;
		}
	}
	return null;
}

function getStandaloneTranscriptPath(session) {
	const expectedName = `${session.id}.txt`;
	const transcriptName = (session.files || []).find(
		(file) => file === expectedName,
	);
	if (!transcriptName) return null;

	const mediaPath = getMediaPath(session);
	if (mediaPath?.includes("/")) {
		const folder = mediaPath.substring(0, mediaPath.lastIndexOf("/"));
		return `${folder}/${transcriptName}`;
	}
	return `wasabi/${session.group}/${session.year}/${transcriptName}`;
}

function getAwsTranscriptPath(session) {
	if (!session.group || !session.year || !session.id) return null;
	return `sessions/${session.group}/${session.year}/${session.id}.txt`;
}

// ---------------------------------------------------------------------------
// Public exports
// ---------------------------------------------------------------------------

export async function loadManifest() {
	return getJsonFile(MANIFEST_PATH);
}

export async function getSessions({ group } = {}) {
	const manifest = await loadManifest();
	const files = manifest.filter(
		(file) =>
			file.path &&
			file.path.endsWith(".json") &&
			file.path !== "/files.json" &&
			matchesGroup(file.path, group),
	);

	const limit = pLimit(25);
	const sessionLists = await Promise.all(
		files.map((file) =>
			limit(async () => {
				try {
					const s3Path = `sync${file.path.startsWith("/") ? "" : "/"}${file.path}.gz`;
					const data = await getJsonFile(s3Path);
					return data.sessions || [];
				} catch (err) {
					structuredLogger.error(
						`[SessionsEdge] Error loading ${file.path}:`,
						err,
					);
					return [];
				}
			}),
		),
	);

	const sessionMap = new Map();
	for (const session of sessionLists.flat()) {
		const key = `${(session.group || "").toLowerCase().trim()}_${session.id}`;
		if (!sessionMap.has(key)) sessionMap.set(key, session);
	}

	const sessions = Array.from(sessionMap.values());
	if (group) {
		const lowerGroup = group.toLowerCase().trim();
		return sessions.filter(
			(session) => (session.group || "").toLowerCase().trim() === lowerGroup,
		);
	}
	return sessions;
}

export function sortSessions(sessions) {
	return sessions.sort((a, b) => {
		const dateA = String(a.date || "").substring(0, 10);
		const dateB = String(b.date || "").substring(0, 10);
		if (dateB > dateA) return 1;
		if (dateB < dateA) return -1;

		const groupDiff = (a.group || "")
			.toLowerCase()
			.localeCompare((b.group || "").toLowerCase());
		if (groupDiff !== 0) return groupDiff;

		return (a.name || "").localeCompare(b.name || "");
	});
}

export function getSProxyUrl(path, baseUrl) {
	if (!path) return null;
	const cleanPath = normalizeProxyPath(path);
	const b64 = encodeBase64Url(cleanPath);
	const ext = path.split(".").pop() || "bin";
	return `${baseUrl}/api/rss/s?p=${b64}&e=.${ext}`;
}

/**
 * Fast, synchronous transcript URL resolver for the RSS feed.
 * Resolves the best available transcript path from session metadata
 * WITHOUT issuing any S3 HeadObject calls.
 */
export function getTranscriptProxyUrlFast(session, baseUrl) {
	if (!session) return null;

	// Prefer explicitly declared paths (highest confidence)
	const explicit =
		session.subtitles?.path ||
		session.transcriptPath ||
		getStandaloneTranscriptPath(session);
	if (explicit) {
		return getSProxyUrl(normalizeProxyPath(explicit), baseUrl);
	}

	// Fall back to the well-known AWS path only when there is evidence a
	// transcript actually exists (transcription flag, summary, etc.)
	if (session.transcription || session.summaryText || session.summary) {
		const awsPath = getAwsTranscriptPath(session);
		if (awsPath) return getSProxyUrl(awsPath, baseUrl);
	}

	return null;
}
