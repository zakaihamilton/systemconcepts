import { makePath } from "@util/path";
import storage from "@util/storage";
import { LIBRARY_LOCAL_PATH } from "@sync/constants";
import { normalizeContent } from "@util/string";
import { splitSmart, mergeChunks } from "./paragraphUtils";

// In-memory cache for paragraphs during search operations
const paragraphCache = new Map();
let paragraphCacheResetTime = 0;
const PARAGRAPH_CACHE_TTL = 10000; // 10 seconds

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
            const session = sessionsById?.get(fileId);
            if (!session) {
                console.warn(`Session not found: ${fileId}`);
                return [];
            }

            let text = `${session.name}\n${session.description || ""}`;

            if (session.summaryText) {
                text += "\n" + session.summaryText;
            } else if (session.summary?.path) {
                const summaryPath = makePath("local/sync", session.summary.path.replace(/\.\.\//g, ""));
                if (await storage.exists(summaryPath)) {
                    const content = await storage.readFile(summaryPath);
                    text += "\n" + content;
                }
            }

            const processed = normalizeContent(text);
            const rawChunks = splitSmart(processed);
            const paragraphs = mergeChunks(rawChunks);
            paragraphCache.set(fileId, paragraphs);
            return paragraphs;
        }

        // Handle articles - load from library
        const tags = await loadLibraryTags();
        const tag = tags.find(t => t._id === fileId);

        if (!tag || !tag.path) {
            console.warn(`Article tag not found or has no path: ${fileId}`);
            return [];
        }

        const filePath = makePath(LIBRARY_LOCAL_PATH, tag.path);
        if (!await storage.exists(filePath)) {
            console.warn(`Article file not found: ${filePath}`);
            return [];
        }

        const fileContent = await storage.readFile(filePath);
        let data = JSON.parse(fileContent);

        let item = null;
        if (Array.isArray(data)) {
            item = data.find(i => i._id === tag._id);
        } else if (data._id === tag._id) {
            item = data;
        }

        if (!item || !item.text) {
            return [];
        }

        const processed = normalizeContent(item.text);
        const rawChunks = splitSmart(processed);
        const paragraphs = mergeChunks(rawChunks);
        paragraphCache.set(fileId, paragraphs);
        return paragraphs;

    } catch (err) {
        console.error(`Failed to load paragraphs for ${fileId}:`, err);
        return [];
    }
}

// Cache for library tags to avoid repeated loads
let tagsCache = null;
let tagsCacheTime = 0;
const CACHE_TTL = 5000; // 5 seconds

async function loadLibraryTags() {
    const now = Date.now();
    if (tagsCache && (now - tagsCacheTime) < CACHE_TTL) {
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
        console.error("Failed to load library tags:", err);
    }

    return [];
}
