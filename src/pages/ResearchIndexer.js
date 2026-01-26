import { useEffect, useCallback, useRef } from "react";
import { makePath } from "@util/path";
import storage from "@util/storage";
import { LIBRARY_LOCAL_PATH } from "@sync/constants";
import { useTranslations } from "@util/translations";
import { ResearchStore } from "./ResearchStore";
import { useLocalStorage } from "@util/store";
import { normalizeContent } from "@util/string";

const INDEX_FILE = "search_index.json";

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
                timestamp: Date.now(),
                files: {},
                tokens: {}
            };

            const total = tags.length;
            let current = 0;

            for (const tag of tags) {
                if (!isMounted.current) break;

                const progressVal = (current / total) * 100;
                ResearchStore.update(s => {
                    s.progress = progressVal;
                });

                const filePath = makePath(LIBRARY_LOCAL_PATH, tag.path);

                try {
                    if (await storage.exists(filePath)) {
                        const fileContent = await storage.readFile(filePath);
                        let data = JSON.parse(fileContent);

                        let item = null;
                        if (Array.isArray(data)) {
                            item = data.find(i => i._id === tag._id);
                        } else if (data._id === tag._id) {
                            item = data;
                        }

                        if (item && item.text) {
                            const text = item.text;
                            // Store metadata and original text
                            newIndex.files[tag._id] = {
                                title: tag.title || tag.chapter || "Untitled",
                                tag: tag,
                                text: text, // Store original text for display
                                paragraphs: []
                            };

                            // Store original text for display
                            // Pre-normalize here to query paragraphs correctly
                            // We do normalizing TWICE (once here, once in SearchResultItem) 
                            // but splitting must happen on valid markdown
                            // To avoid double processing and ensure consistency, we use the helper
                            const processed = normalizeContent(text);

                            // Split by double newlines, but preserve code blocks
                            const splitSmart = (txt) => {
                                const chunks = [];
                                // Regex to match code blocks: ``` ... ``` (lazy)
                                // or just text chunks separated by \n\n+
                                // We iterate.
                                let remaining = txt;
                                while (remaining) {
                                    // Find next code fence
                                    const fenceIdx = remaining.indexOf("```");
                                    if (fenceIdx === -1) {
                                        // No more fences, split remainder by \n\n
                                        const parts = remaining.split(/\n\n+/).filter(p => p.trim());
                                        chunks.push(...parts);
                                        break;
                                    }

                                    // Content before fence
                                    const before = remaining.substring(0, fenceIdx);
                                    if (before.trim()) {
                                        const parts = before.split(/\n\n+/).filter(p => p.trim());
                                        chunks.push(...parts);
                                    }

                                    // Find end of fence
                                    // We need to skip the opening backticks
                                    const openFenceEnd = remaining.indexOf("\n", fenceIdx);
                                    if (openFenceEnd === -1) {
                                        // Edge case: fence at end of string?
                                        chunks.push(remaining.substring(fenceIdx));
                                        break;
                                    }

                                    const closeFenceIdx = remaining.indexOf("```", openFenceEnd);
                                    if (closeFenceIdx === -1) {
                                        // Unclosed block? Treat as text
                                        const rest = remaining.substring(fenceIdx);
                                        // But wait, if we treat as text, subsequent \n\n will split it.
                                        // Better to treat as one block if it looks like a code block.
                                        chunks.push(rest);
                                        break;
                                    }

                                    // Include closing fence lines
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

                                // Helper to identify type
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

                                    // Check strictly if types match and are list/quote
                                    if (prevType === currType && ['ul', 'ol', 'quote'].includes(currType)) {
                                        merged[merged.length - 1] += "\n\n" + curr;
                                    } else {
                                        merged.push(curr);
                                    }
                                }
                                return merged;
                            };

                            const rawChunks = splitSmart(processed);
                            const paragraphs = mergeChunks(rawChunks);

                            paragraphs.forEach((para, paraIndex) => {

                                const paraTokens = para.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
                                const uniqueTokens = [...new Set(paraTokens)];

                                if (uniqueTokens.length === 0) return;

                                // Add to file data
                                newIndex.files[tag._id].paragraphs.push(para);

                                // Add to token index
                                uniqueTokens.forEach(token => {
                                    if (!newIndex.tokens[token]) {
                                        newIndex.tokens[token] = [];
                                    }
                                    // Store reference as "docId:paraIndex"
                                    newIndex.tokens[token].push(`${tag._id}:${paraIndex}`);
                                });
                            });
                            // Store lengths for end indicator check
                            newIndex.files[tag._id].totalParagraphs = paragraphs.length;
                        }
                    }
                } catch (err) {
                    console.warn(`Failed to index file for tag ${tag._id}:`, err);
                }

                current++;
            }

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
