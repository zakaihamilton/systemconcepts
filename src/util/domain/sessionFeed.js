import { metadataInfo as awsMetadataInfo, downloadData } from "@util/storage/aws";
import pLimit from "@util/data/p-limit";
import { metadataInfo as wasabiMetadataInfo } from "@util/storage/wasabi";
import pako from "pako";

const MANIFEST_PATH = "sync/files.json.gz";
const CACHE_TTL_MS = 60 * 1000;
const decoder = new TextDecoder("utf-8");
const cache = new Map();

function decodeData(data) {
	try {
		return decoder.decode(pako.inflate(data));
	} catch (_err) {
		return Buffer.from(data).toString("utf-8");
	}
}

async function getJsonFile(path) {
	const now = Date.now();
	const cached = cache.get(path);
	if (cached && cached.expiresAt > now) return cached.promise;

	const promise = downloadData({ path, binary: true }).then((data) =>
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

export async function getSessions({ group } = {}) {
	const manifest = await getJsonFile(MANIFEST_PATH);
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
					console.error(`[Sessions] Error loading ${file.path}:`, err);
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
	const b64 = Buffer.from(cleanPath).toString("base64url");
	const ext = path.split(".").pop() || "bin";
	return `${baseUrl}/api/rss/s?p=${b64}&e=.${ext}`;
}

function normalizeProxyPath(path) {
	return path.replace(/^\//, "").replace(/^aws\//, "");
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

function getInferredTranscriptPath(session) {
	const mediaPath = getMediaPath(session);
	if (!mediaPath) return null;

	const dotIndex = mediaPath.lastIndexOf(".");
	if (dotIndex === -1) return null;

	return `${mediaPath.substring(0, dotIndex)}.txt`;
}

async function getExistingTranscriptPath(path) {
	if (!path) return null;

	const cleanPath = normalizeProxyPath(path);
	const wasabiKey = cleanPath.replace(/^wasabi\//, "");
	const exists = cleanPath.startsWith("wasabi/")
		? await wasabiMetadataInfo({ path: wasabiKey })
		: await awsMetadataInfo({ path: cleanPath });

	return exists ? cleanPath : null;
}

async function getExistingInferredTranscriptPath(session) {
	const hasTranscriptEvidence =
		session.transcription || session.summaryText || session.summary;
	const logContext = {
		id: session?.id,
		group: session?.group,
		year: session?.year,
		transcription: !!session?.transcription,
		hasSummary: !!(session?.summaryText || session?.summary),
	};
	if (!hasTranscriptEvidence) {
		console.log("[Sessions API] Skipping inferred transcript lookup", {
			...logContext,
			reason: "no transcript evidence",
		});
		return null;
	}

	const transcriptPath = getInferredTranscriptPath(session);
	if (!transcriptPath) {
		console.log("[Sessions API] Skipping inferred transcript lookup", {
			...logContext,
			reason: "no media path",
			audioPath: session.audio?.path || null,
			videoPath: session.video?.path || null,
			resolutionKeys: Object.keys(session.resolutions || {}),
			files: session.files || [],
		});
		return null;
	}

	const resolvedPath = await getExistingTranscriptPath(transcriptPath);
	console.log("[Sessions API] Checked inferred transcript", {
		...logContext,
		mediaPath: getMediaPath(session),
		transcriptPath,
		resolvedPath,
		exists: !!resolvedPath,
	});
	return resolvedPath;
}

export async function getTranscriptProxyUrl(session, baseUrl) {
	if (!session) return null;

	const candidatePaths = [
		session.subtitles?.path,
		session.transcriptPath,
		getStandaloneTranscriptPath(session),
		getAwsTranscriptPath(session),
	];
	let transcriptPath = null;
	for (const candidatePath of candidatePaths) {
		transcriptPath = await getExistingTranscriptPath(candidatePath);
		if (transcriptPath) break;
	}
	if (!transcriptPath) {
		transcriptPath = await getExistingInferredTranscriptPath(session);
	}
	console.log("[Sessions API] Resolved transcript URL", {
		id: session.id,
		group: session.group,
		year: session.year,
		candidatePaths: candidatePaths.filter(Boolean),
		resolvedTranscriptPath: transcriptPath || null,
		hasUrl: !!transcriptPath,
	});
	if (transcriptPath) {
		return getSProxyUrl(transcriptPath, baseUrl);
	}

	return null;
}

/**
 * Fast, synchronous transcript URL resolver for the RSS feed.
 * Resolves the best available transcript path from session metadata
 * WITHOUT issuing any S3 HeadObject calls. Podcast clients silently
 * ignore broken transcript URLs, so skipping existence checks is safe
 * at feed-generation time.
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
