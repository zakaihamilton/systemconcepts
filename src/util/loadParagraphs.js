import { makePath } from "@util/path";
import storage from "@util/storage";
import { LIBRARY_LOCAL_PATH } from "@sync/constants";
import { normalizeContent } from "@util/string";

// Split by double newlines, but preserve code blocks
export const splitSmart = (txt) => {
    const chunks = [];
    let remaining = txt;
    while (remaining) {
        const fenceIdx = remaining.indexOf("```");
        if (fenceIdx === -1) {
            const parts = remaining.split(/\n\n+/).filter(p => p.trim());
            chunks.push(...parts);
            break;
        }
        const before = remaining.substring(0, fenceIdx);
        if (before.trim()) {
            const parts = before.split(/\n\n+/).filter(p => p.trim());
            chunks.push(...parts);
        }
        const openFenceEnd = remaining.indexOf("\n", fenceIdx);
        if (openFenceEnd === -1) {
            chunks.push(remaining.substring(fenceIdx));
            break;
        }
        const closeFenceIdx = remaining.indexOf("```", openFenceEnd);
        if (closeFenceIdx === -1) {
            chunks.push(remaining.substring(fenceIdx));
            break;
        }
        let closeFenceEnd = remaining.indexOf("\n", closeFenceIdx);
        if (closeFenceEnd === -1) closeFenceEnd = remaining.length;
        const codeBlock = remaining.substring(fenceIdx, closeFenceEnd);
        chunks.push(codeBlock);
        remaining = remaining.substring(closeFenceEnd).trimStart();
    }
    return chunks;
};

const getLastLine = (text) => {
    const lastIndex = text.lastIndexOf('\n');
    if (lastIndex === -1) return text;
    return text.substring(lastIndex + 1);
};

const getFirstLine = (text) => {
    const firstIndex = text.indexOf('\n');
    if (firstIndex === -1) return text;
    return text.substring(0, firstIndex);
};

export const mergeChunks = (chunks) => {
    if (chunks.length === 0) return chunks;
    const merged = [chunks[0]];
    const getType = (line) => {
        const trimmed = line.trim();
        if (/^```/.test(trimmed)) return 'code';
        if (/^[-*]\s/.test(trimmed)) return 'ul';
        if (/^>\s/.test(trimmed)) return 'quote';
        if (/^\d+\.\s/.test(trimmed)) return 'ol';
        return 'text';
    };
    for (let i = 1; i < chunks.length; i++) {
        const prev = merged[merged.length - 1];
        const curr = chunks[i];

        const prevLastLine = getLastLine(prev);
        const currFirstLine = getFirstLine(curr);

        const prevType = getType(prevLastLine);
        const currType = getType(currFirstLine);
        if (prevType === currType && ['ul', 'ol', 'quote'].includes(currType)) {
            merged[merged.length - 1] += "\n\n" + curr;
        } else {
            merged.push(curr);
        }
    }
    return merged;
};

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
