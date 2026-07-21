import { LIBRARY_LOCAL_PATH } from "@sync/constants";
import { logger as structuredLogger } from "@util/api/logger";
import { makePath } from "@util/data/path";
import { normalizeContent } from "@util/data/string";
import { splitIntoParagraphs } from "@util/domain/splitParagraphs";
import storage from "@util/storage/storage";

const sanitizeRelativePath = (input = "") => {
	return String(input)
		.split(/[/\\]/)
		.filter((segment) => segment !== ".." && segment !== ".")
		.join("/");
};

// In-memory cache for paragraphs during search operations
const paragraphCache = new Map();
let paragraphCacheResetTime = 0;
const PARAGRAPH_CACHE_TTL = 10000; // 10 seconds

const sessionRecordCache = new Map();
let sessionRecordCacheResetTime = 0;

function parseSessionFileId(fileId) {
	const parts = String(fileId || "").split("|");
	if (parts.length < 5 || parts[0] !== "session") return null;
	return {
		group: parts[1],
		year: parts[2],
		date: parts[3],
		name: parts.slice(4).join("|"),
	};
}

function sessionMatchesId(session, { group, year, date, name }) {
	return (
		session &&
		String(session.group) === String(group) &&
		String(session.year) === String(year) &&
		String(session.date) === String(date) &&
		String(session.name) === String(name)
	);
}

async function readSessionsFromPath(path) {
	if (!(await storage.exists(path))) return null;
	const content = await storage.readFile(path);
	const data = JSON.parse(content);
	return Array.isArray(data?.sessions) ? data.sessions : null;
}

/**
 * Catalogue list items intentionally omit summaryText/description for memory.
 * Search still needs the same text the indexer used, so reload the full record
 * from sync storage when those fields are missing.
 */
async function resolveSessionRecord(fileId, listSession) {
	if (listSession?.summaryText || listSession?.description) {
		return listSession;
	}

	const id = parseSessionFileId(fileId);
	if (!id) return listSession || null;

	const now = Date.now();
	if (now - sessionRecordCacheResetTime > PARAGRAPH_CACHE_TTL) {
		sessionRecordCache.clear();
		sessionRecordCacheResetTime = now;
	}
	if (sessionRecordCache.has(fileId)) {
		return sessionRecordCache.get(fileId);
	}

	const safeGroupName = String(id.group).replace(/[./\\]/g, "_");
	const candidatePaths = [
		makePath(`local/sync/${safeGroupName}.json`),
		makePath("local/sync", id.group, `${id.year}.json`),
	];

	for (const path of candidatePaths) {
		try {
			const sessions = await readSessionsFromPath(path);
			if (!sessions) continue;
			const match = sessions.find((session) => sessionMatchesId(session, id));
			if (match) {
				const resolved = {
					...listSession,
					...match,
					summary: listSession?.summary || match.summary || null,
				};
				sessionRecordCache.set(fileId, resolved);
				return resolved;
			}
		} catch (err) {
			structuredLogger.warn(`Failed to read session record from ${path}:`, err);
		}
	}

	sessionRecordCache.set(fileId, listSession || null);
	return listSession || null;
}

async function buildSessionText(session) {
	let text = `${session.name}\n${session.description || ""}`;

	if (session.summaryText) {
		text += "\n" + session.summaryText;
	} else if (session.summary?.path) {
		const summaryPath = makePath(
			"local/sync",
			sanitizeRelativePath(session.summary.path),
		);
		if (await storage.exists(summaryPath)) {
			const content = await storage.readFile(summaryPath);
			text += "\n" + content;
		}
	}

	return text;
}

/**
 * Load paragraphs for a given file ID (session or article)
 * @param {string} fileId - The file identifier (session|... or article _id)
 * @param {object} sessionsById - Map of session IDs to session objects
 * @returns {Promise<string[]>} Array of paragraph strings
 */
export async function loadParagraphsForFile(fileId, sessionsById) {
	// Check cache first
	const now = Date.now();
	if (now - paragraphCacheResetTime > PARAGRAPH_CACHE_TTL) {
		paragraphCache.clear();
		paragraphCacheResetTime = now;
	}

	if (paragraphCache.has(fileId)) {
		return paragraphCache.get(fileId);
	}

	try {
		// Handle sessions
		if (fileId.startsWith("session|")) {
			const listSession = sessionsById?.get(fileId);
			const session = await resolveSessionRecord(fileId, listSession);
			if (!session) {
				structuredLogger.warn(`Session not found: ${fileId}`);
				return [];
			}

			const text = await buildSessionText(session);
			const processed = normalizeContent(text);
			const paragraphs = splitIntoParagraphs(processed);
			paragraphCache.set(fileId, paragraphs);
			return paragraphs;
		}

		// Handle articles - load from library
		const tags = await loadLibraryTags();
		const tag = tags.find((t) => t._id === fileId);

		if (!tag || !tag.path) {
			structuredLogger.warn(`Article tag not found or has no path: ${fileId}`);
			return [];
		}

		const filePath = makePath(LIBRARY_LOCAL_PATH, tag.path);
		if (!(await storage.exists(filePath))) {
			structuredLogger.warn(`Article file not found: ${filePath}`);
			return [];
		}

		const fileContent = await storage.readFile(filePath);
		let data = JSON.parse(fileContent);

		let item = null;
		if (Array.isArray(data)) {
			item = data.find((i) => i._id === tag._id);
		} else if (data._id === tag._id) {
			item = data;
		}

		if (!item || !item.text) {
			return [];
		}

		const processed = normalizeContent(item.text);
		const paragraphs = splitIntoParagraphs(processed);
		paragraphCache.set(fileId, paragraphs);
		return paragraphs;
	} catch (err) {
		structuredLogger.error(`Failed to load paragraphs for ${fileId}:`, err);
		return [];
	}
}

/** @internal Test helper to clear paragraph caches between cases. */
export function clearParagraphCaches() {
	paragraphCache.clear();
	paragraphCacheResetTime = 0;
	sessionRecordCache.clear();
	sessionRecordCacheResetTime = 0;
}

// Cache for library tags to avoid repeated loads
let tagsCache = null;
let tagsCacheTime = 0;
const CACHE_TTL = 5000; // 5 seconds

async function loadLibraryTags() {
	const now = Date.now();
	if (tagsCache && now - tagsCacheTime < CACHE_TTL) {
		return tagsCache;
	}

	try {
		const tagsPath = makePath(LIBRARY_LOCAL_PATH, "tags.json");
		if (await storage.exists(tagsPath)) {
			const tagsContent = await storage.readFile(tagsPath);
			tagsCache = JSON.parse(tagsContent);
			tagsCacheTime = now;
			return tagsCache;
		}
	} catch (err) {
		structuredLogger.error("Failed to load library tags:", err);
	}

	return [];
}
