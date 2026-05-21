import { downloadData } from "@util/aws";
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
