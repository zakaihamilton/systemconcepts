import { downloadData, metadataInfo as awsMetadataInfo } from "@util/aws";
import pLimit from "@util/p-limit";
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

	const limit = pLimit(10);
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
	const cleanPath = path.startsWith("/") ? path.substring(1) : path;
	const b64 = Buffer.from(cleanPath).toString("base64url");
	const ext = path.split(".").pop() || "bin";
	return `${baseUrl}/api/rss/s?p=${b64}&e=.${ext}`;
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

function getInferredTranscriptPath(session) {
	const mediaPath = getMediaPath(session);
	if (!mediaPath) return null;

	const dotIndex = mediaPath.lastIndexOf(".");
	if (dotIndex === -1) return null;

	return `${mediaPath.substring(0, dotIndex)}.txt`;
}

async function getExistingInferredTranscriptPath(session) {
	const logContext = {
		id: session?.id,
		group: session?.group,
		year: session?.year,
		transcription: !!session?.transcription,
	};
	if (!session.transcription) {
		console.log("[Sessions API] Skipping inferred transcript lookup", {
			...logContext,
			reason: "session.transcription is false",
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

	const cleanPath = transcriptPath
		.replace(/^\//, "")
		.replace(/^sessions\//, "")
		.replace(/^wasabi\//, "");
	const metadataPath = "sessions/" + cleanPath;
	const exists = await awsMetadataInfo({ path: metadataPath });
	console.log("[Sessions API] Checked inferred transcript", {
		...logContext,
		mediaPath: getMediaPath(session),
		transcriptPath,
		wasabiKey: cleanPath,
		metadataPath,
		exists: !!exists,
	});
	return exists ? metadataPath : null;
}

export async function getTranscriptProxyUrl(session, baseUrl) {
	if (!session) return null;

	const explicitTranscriptPath = session.subtitles?.path || session.transcriptPath;
	const listedTranscriptPath = getStandaloneTranscriptPath(session);
	const transcriptPath =
		explicitTranscriptPath ||
		listedTranscriptPath ||
		(await getExistingInferredTranscriptPath(session));
	console.log("[Sessions API] Resolved transcript URL", {
		id: session.id,
		group: session.group,
		year: session.year,
		explicitTranscriptPath: explicitTranscriptPath || null,
		listedTranscriptPath: listedTranscriptPath || null,
		resolvedTranscriptPath: transcriptPath || null,
		hasUrl: !!transcriptPath,
	});
	if (transcriptPath) {
		return getSProxyUrl(transcriptPath, baseUrl);
	}

	return null;
}
