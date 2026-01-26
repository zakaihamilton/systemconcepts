import { useEffect, useCallback, useRef } from "react";
import { makePath } from "@util/path";
import storage from "@util/storage";
import { LIBRARY_LOCAL_PATH } from "@sync/constants";
import { useTranslations } from "@util/translations";
import { ResearchStore } from "./ResearchStore";
import { useLocalStorage } from "@util/store";
import { normalizeContent } from "@util/string";
import pLimit from "@util/p-limit";

const limit = pLimit(20);

const STOP_WORDS = new Set([
    "a", "an", "and", "are", "as", "at", "be", "but", "by", "for", "if", "in", "into", "is", "it",
    "no", "not", "of", "on", "or", "such", "that", "the", "their", "then", "there", "these",
    "they", "this", "to", "was", "will", "with"
]);

const INDEX_FILE = "search_index.json";

// Split by double newlines, but preserve code blocks
const splitSmart = (txt) => {
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

const mergeChunks = (chunks) => {
    if (chunks.length === 0) return chunks;
    const merged = [chunks[0]];
    const getType = (text) => {
        const firstLine = text.split('\n')[0].trim();
        if (/^```/.test(firstLine)) return 'code';
        if (/^[-*]\s/.test(firstLine)) return 'ul';
        if (/^>\s/.test(firstLine)) return 'quote';
        if (/^\d+\.\s/.test(firstLine)) return 'ol';
        return 'text';
    };
    for (let i = 1; i < chunks.length; i++) {
        const prev = merged[merged.length - 1];
        const curr = chunks[i];
        const prevLastLine = prev.split('\n').pop().trim();
        const currFirstLine = curr.split('\n')[0].trim();
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

export default function ResearchIndexer() {
    const translations = useTranslations();
    const { indexing } = ResearchStore.useState();
    const isMounted = useRef(true);
    const inProgress = useRef(false);
    useLocalStorage("ResearchStore", ResearchStore, ["query", "filterTags"]);

    useEffect(() => {
        isMounted.current = true;
        return () => { isMounted.current = false; };
    }, []);

    const buildIndex = useCallback(async () => {
        if (inProgress.current) return;
        inProgress.current = true;

        ResearchStore.update(s => {
            s.progress = 0;
            s.status = translations.LOADING_TAGS;
        });

        try {
            const tagsPath = makePath(LIBRARY_LOCAL_PATH, "tags.json");
            if (!await storage.exists(tagsPath)) {
                ResearchStore.update(s => {
                    s.status = translations.NO_TAGS_FOUND;
                    s.indexing = false;
                });
                inProgress.current = false;
                return;
            }

            const tagsContent = await storage.readFile(tagsPath);
            const tags = JSON.parse(tagsContent);

            const newIndex = {
                v: 3,
                timestamp: Date.now(),
                f: [], // file IDs
                d: {}, // doc paragraphs: { fileIndex: [paragraphs] }
                t: {}  // tokens: { token: [fileIndex, paraIndex, ...] }
            };

            const tagsByPath = {};
            tags.forEach(tag => {
                if (!tagsByPath[tag.path]) tagsByPath[tag.path] = [];
                tagsByPath[tag.path].push(tag);
            });

            const uniquePaths = Object.keys(tagsByPath);
            const totalPaths = uniquePaths.length;
            let pathsProcessed = 0;

            const processPath = async (path) => {
                if (!isMounted.current) return;

                const filePath = makePath(LIBRARY_LOCAL_PATH, path);
                const pathTags = tagsByPath[path];

                try {
                    if (await storage.exists(filePath)) {
                        const fileContent = await storage.readFile(filePath);
                        let data = JSON.parse(fileContent);

                        for (const tag of pathTags) {
                            let item = null;
                            if (Array.isArray(data)) {
                                item = data.find(i => i._id === tag._id);
                            } else if (data._id === tag._id) {
                                item = data;
                            }

                            if (item && item.text) {
                                const text = item.text;
                                const processed = normalizeContent(text);
                                const rawChunks = splitSmart(processed);
                                const paragraphs = mergeChunks(rawChunks);

                                if (paragraphs.length > 0) {
                                    // Atomic update (no await between these lines)
                                    const fileIndex = newIndex.f.length;
                                    newIndex.f.push(tag._id);
                                    newIndex.d[fileIndex] = paragraphs;

                                    paragraphs.forEach((para, paraIndex) => {
                                        const paraTokens = para.toLowerCase().split(/[^a-z0-9\u0590-\u05FF]+/).filter(Boolean);
                                        const uniqueTokens = [...new Set(paraTokens)];

                                        if (uniqueTokens.length === 0) return;

                                        uniqueTokens.forEach(token => {
                                            // Skip stop words and very short tokens (unless they are numeric)
                                            if (STOP_WORDS.has(token)) return;
                                            if (token.length < 3 && !/^\d+$/.test(token)) return;

                                            if (!newIndex.t[token]) {
                                                newIndex.t[token] = [];
                                            }
                                            // V3: flat integer array [fileIdx, paraIdx, ...]
                                            newIndex.t[token].push(fileIndex, paraIndex);
                                        });
                                    });
                                }
                            }
                        }
                    }
                } catch (err) {
                    console.warn(`Failed to index file at ${path}:`, err);
                }

                pathsProcessed++;
                const progressVal = (pathsProcessed / totalPaths) * 100;
                ResearchStore.update(s => {
                    s.progress = progressVal;
                });
            };

            await Promise.all(uniquePaths.map(path => limit(() => processPath(path))));

            if (isMounted.current) {
                const indexPath = makePath(LIBRARY_LOCAL_PATH, INDEX_FILE);
                await storage.createFolderPath(indexPath);
                await storage.writeFile(indexPath, JSON.stringify(newIndex));

                ResearchStore.update(s => {
                    s.status = translations.DONE;
                    s.indexTimestamp = Date.now();
                });
            }

        } catch (err) {
            console.error("Indexing failed:", err);
            if (isMounted.current) {
                ResearchStore.update(s => {
                    s.status = translations.INDEXING_FAILED;
                });
            }
        } finally {
            inProgress.current = false;
            if (isMounted.current) {
                ResearchStore.update(s => {
                    s.indexing = false;
                });
                setTimeout(() => {
                    if (isMounted.current) {
                        ResearchStore.update(s => {
                            s.status = "";
                        });
                    }
                }, 2000);
            }
        }

    }, [translations]);

    useEffect(() => {
        if (indexing && !inProgress.current) {
            buildIndex();
        }
    }, [indexing, buildIndex]);

    return null;
}
