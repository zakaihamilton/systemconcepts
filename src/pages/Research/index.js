import React, { useState, useEffect, useCallback, useRef, useMemo, useContext } from "react";
import Cookies from "js-cookie";
import { createPortal } from "react-dom";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import LinearProgress from "@mui/material/LinearProgress";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import InputAdornment from "@mui/material/InputAdornment";
import SearchIcon from "@mui/icons-material/Search";
import RefreshIcon from "@mui/icons-material/Refresh";
import ClearIcon from "@mui/icons-material/Clear";
import PrintIcon from "@mui/icons-material/Print";
import FormatListNumberedIcon from "@mui/icons-material/FormatListNumbered";
import IconButton from "@mui/material/IconButton";
import Autocomplete from "@mui/material/Autocomplete";
import Chip from "@mui/material/Chip";
import Paper from "@mui/material/Paper";
import { makePath } from "@util/path";
import storage from "@util/storage";
import { SyncActiveStore } from "@sync/syncState";
import { LIBRARY_LOCAL_PATH } from "@sync/constants";
import { useTranslations } from "@util/translations";
import { roleAuth } from "@util/roles";
import { setPath, usePathItems, setHash } from "@util/pages";
import { normalizeContent } from "@util/string";
import styles from "./Research.module.scss";
import { LibraryTagKeys } from "@pages/Library/Icons";
import { useToolbar, registerToolbar } from "@components/Toolbar";
import { LibraryStore } from "@pages/Library/Store";
import { useSessions } from "@util/sessions";
import { ResearchStore } from "@pages/ResearchStore";
import Article from "@pages/Library/Article";
import { ContentSize } from "@components/Page/Content";
import { VariableSizeList } from "react-window";
import { useDeviceType } from "@util/styles";
import ScrollToTop from "@pages/Library/Article/ScrollToTop";
import JumpDialog from "@pages/Library/Article/JumpDialog";
import PageIndicator from "./PageIndicator";
import SearchResultItem from "./SearchResultItem";
import { decodeBinaryIndex } from "@util/searchIndexBinary";
import { loadParagraphsForFile } from "@util/loadParagraphs";

const INDEX_FILE = "search_index.bin";
const LEGACY_INDEX_FILE = "search_index.json";

function getTagHierarchy(tag) {
    const hierarchy = LibraryTagKeys.map(key => tag[key]).map(v => v ? String(v).trim() : null).filter(Boolean);
    if (tag.number && hierarchy.length > 0) {
        hierarchy[hierarchy.length - 1] = `${hierarchy[hierarchy.length - 1]}:${tag.number}`;
    }
    return hierarchy;
}

registerToolbar("Research");

export default function Research() {
    const translations = useTranslations();
    const { query, filterTags, results, hasSearched, _loaded, highlight, indexing, progress, status, indexTimestamp } = ResearchStore.useState();
    const [sessions] = useSessions([], { filterSessions: false, skipSync: true });
    const [indexData, setIndexData] = useState(null);
    const [availableFilters, setAvailableFilters] = useState([]);
    const libraryUpdateCounter = SyncActiveStore.useState(s => s.libraryUpdateCounter);
    const [searching, setSearching] = useState(false);
    const [searchProgress, setSearchProgress] = useState(0);
    const [showProgress, setShowProgress] = useState(false);
    const searchTimer = useRef(null);
    const isMounted = useRef(true);
    const size = useContext(ContentSize);
    const listRef = useRef();
    const rowHeights = useRef({});
    const deviceType = useDeviceType();
    const isMobile = deviceType !== "desktop";
    const outerRef = useRef(null);
    const [scrollPages, setScrollPages] = useState({ page: 1, count: 1, visible: false });
    const scrollTimeoutRef = useRef(null);
    const [appliedFilterTags, setAppliedFilterTags] = useState(hasSearched ? filterTags : []);
    const [searchCollapsed, setSearchCollapsed] = useState(false);
    const [jumpOpen, setJumpOpen] = useState(false);
    const [printing, setPrinting] = useState(false);
    const [showScrollTop, setShowScrollTop] = useState(false);
    const [printRoot, setPrintRoot] = useState(null);
    const [filterInput, setFilterInput] = useState("");
    const isJumping = useRef(false);
    const jumpTimeout = useRef(null);
    const resetTimer = useRef(null);
    const currentPageRef = useRef(1);
    const pendingPathRef = useRef(null);
    const initialUrlHandled = useRef(false);
    const role = Cookies.get("role");
    const isAdmin = roleAuth(role, "admin");

    useEffect(() => {
        currentPageRef.current = scrollPages.page;
    }, [scrollPages.page]);

    useEffect(() => {
        let element = document.getElementById("print-root");
        if (!element) {
            element = document.createElement("div");
            element.id = "print-root";
            document.body.appendChild(element);
        }
        setPrintRoot(element);
        return () => {
            if (element && document.body.contains(element)) {
                document.body.removeChild(element);
            }
        };
    }, []);

    const handlePrint = useCallback(() => {
        setPrinting(true);
        setTimeout(() => {
            window.print();
            setPrinting(false);
        }, 500);
    }, []);

    const minResetIndex = useRef(Infinity);

    const setRowHeight = useCallback((index, height) => {
        if (Math.abs((rowHeights.current[index] || 0) - height) > 5) {
            rowHeights.current[index] = height;
            minResetIndex.current = Math.min(minResetIndex.current, index);
            if (listRef.current) {
                if (resetTimer.current) {
                    clearTimeout(resetTimer.current);
                }
                resetTimer.current = setTimeout(() => {
                    if (listRef.current) {
                        listRef.current.resetAfterIndex(minResetIndex.current);
                        minResetIndex.current = Infinity;
                    }
                    resetTimer.current = null;
                }, 200);
            }
        }
    }, []);

    useEffect(() => {
        isMounted.current = true;
        return () => { isMounted.current = false; };
    }, []);

    const setQuery = useCallback((val) => {
        ResearchStore.update(s => { s.query = val; });
    }, []);

    const setFilterTags = useCallback((val) => {
        ResearchStore.update(s => { s.filterTags = val; });
    }, []);

    const setResults = useCallback((val) => {
        ResearchStore.update(s => { s.results = val; });
    }, []);

    const loadTags = useCallback(async () => {
        try {
            const tagsPath = makePath(LIBRARY_LOCAL_PATH, "tags.json");
            if (await storage.exists(tagsPath)) {
                const tagsContent = await storage.readFile(tagsPath);
                const tags = JSON.parse(tagsContent);
                const unique = new Set();
                tags.forEach(tag => {
                    LibraryTagKeys.forEach(key => {
                        if (tag[key]) {
                            const label = String(tag[key]).trim();
                            unique.add(JSON.stringify({ label, type: key }));
                        }
                    });
                });

                if (sessions) {
                    const capitalize = (s) => {
                        if (!s) return "";
                        const str = String(s);
                        if (str.toLowerCase() === "ai") return "AI";
                        return str.charAt(0).toUpperCase() + str.slice(1);
                    };
                    sessions.forEach(session => {
                        if (session.group) unique.add(JSON.stringify({ label: capitalize(session.group), type: "group" }));
                        if (session.year) unique.add(JSON.stringify({ label: session.year, type: "year" }));
                        if (session.type) unique.add(JSON.stringify({ label: capitalize(session.type), type: "type" }));
                    });
                }
                unique.add(JSON.stringify({ label: translations.SESSIONS, type: "source", id: "SESSIONS" }));
                unique.add(JSON.stringify({ label: translations.ARTICLES, type: "source", id: "ARTICLES" }));
                unique.add(JSON.stringify({ label: translations.SUMMARIES, type: "source", id: "SUMMARIES" }));
                unique.add(JSON.stringify({ label: translations.TRANSCRIPTIONS, type: "source", id: "TRANSCRIPTIONS" }));

                if (isMounted.current) {
                    const filters = Array.from(unique).map(s => JSON.parse(s));
                    filters.sort((a, b) => a.label.localeCompare(b.label));
                    setAvailableFilters(filters);
                    LibraryStore.update(s => {
                        s.tags = tags;
                    });
                }
            }
        } catch (err) {
            console.error("Failed to load tags for filters:", err);
        }
    }, [sessions, translations]);

    const buildIndex = useCallback(async () => {
        ResearchStore.update(s => { s.indexing = true; });
    }, []);

    const loadIndex = useCallback(async () => {
        try {
            const indexPath = makePath(LIBRARY_LOCAL_PATH, INDEX_FILE);
            if (await storage.exists(indexPath)) {
                const content = await storage.readFile(indexPath);
                const data = decodeBinaryIndex(content);
                if (isMounted.current) {
                    setIndexData(data);
                }
            } else {
                // Try legacy JSON format for migration
                const legacyPath = makePath(LIBRARY_LOCAL_PATH, LEGACY_INDEX_FILE);
                if (await storage.exists(legacyPath)) {
                    const content = await storage.readFile(legacyPath);
                    const data = JSON.parse(content);
                    if (isMounted.current) {
                        setIndexData(data);
                    }
                } else {
                    // Auto-build if not exists
                    buildIndex();
                }
            }
        } catch (err) {
            console.error("Failed to load search index:", err);
        }
    }, [buildIndex]);

    useEffect(() => {
        loadTags();
        loadIndex();
    }, [loadTags, loadIndex, indexTimestamp, sessions]);

    useEffect(() => {
        if (libraryUpdateCounter > 0) {
            loadIndex();
            loadTags();
        }
    }, [libraryUpdateCounter, loadIndex, loadTags, sessions]);

    const sessionsById = useMemo(() => {
        if (!sessions) {
            return new Map();
        }
        return sessions.reduce((map, session) => {
            const sessionId = `session|${session.group}|${session.year}|${session.date}|${session.name}`;
            map.set(sessionId, session);
            return map;
        }, new Map());
    }, [sessions]);

    const handleSearch = useCallback(async (isRestoring = false) => {
        // const isDifferentSearch = query !== lastSearch.query || JSON.stringify(filterTags) !== JSON.stringify(lastSearch.filterTags);
        // const currentSearch = { query, filterTags };
        // setLastSearch(currentSearch);
        if (filterTags.length > 0) {
            // Debug logs removed
        }
        setAppliedFilterTags(filterTags);
        if (!indexData || (!query.trim() && !filterTags.length)) {
            setResults([]);
            ResearchStore.update(s => { s.hasSearched = true; });
            return;
        }

        setSearching(true);
        setSearchProgress(0);
        setShowProgress(false);

        if (searchTimer.current) clearTimeout(searchTimer.current);
        searchTimer.current = setTimeout(() => {
            if (isMounted.current) setShowProgress(true);
        }, 1000);

        // Allow UI to update
        await new Promise(resolve => setTimeout(resolve, 0));

        try {
            const orGroups = query.split(/\s+OR\s+/).map(g => g.trim()).filter(Boolean);
            const searchTerms = [];
            let finalRefs = new Set();

            const isV2 = indexData.v === 2;
            const isV3 = indexData.v === 3;
            const isV4 = indexData.v === 4;
            const isV5 = indexData.v >= 5;

            if (!query.trim()) {
                if (indexData.f) {
                    for (let i = 0; i < indexData.f.length; i++) {
                        finalRefs.add(`${i}:0`);
                    }
                }
            } else {

                for (const orGroup of orGroups) {
                    const andClauses = orGroup.split(/\s+AND\s+/).map(c => c.trim()).filter(Boolean);
                    if (andClauses.length === 0) continue;

                    const parsedAndClauses = andClauses.map(clause => {
                        const terms = clause.toLowerCase().split(/[^a-z0-9\u0590-\u05FF]+/).filter(Boolean);
                        return { raw: clause, terms };
                    });

                    const allTokensInGroup = [...new Set(parsedAndClauses.flatMap(c => c.terms))];
                    searchTerms.push(...parsedAndClauses.map(c => c.raw));

                    let groupRefs = null;

                    for (const token of allTokensInGroup) {
                        if (!isMounted.current) return;

                        const matchingTokens = Object.keys(indexData.t || indexData.tokens || {}).filter(k => k.includes(token));
                        let tokenRefs = new Set();
                        matchingTokens.forEach(k => {
                            const refs = (isV2 || isV3 || isV4 || isV5) ? indexData.t[k] : indexData.tokens[k];
                            if (isV4 || isV5) {
                                let currentFileIndex = -1;
                                for (let i = 0; i < refs.length; i++) {
                                    const val = refs[i];
                                    if (val < 0) {
                                        currentFileIndex = -val - 1;
                                    } else {
                                        if (currentFileIndex !== -1) {
                                            tokenRefs.add(`${currentFileIndex}:${val}`);
                                        }
                                    }
                                }
                            } else if (isV3) {
                                for (let i = 0; i < refs.length; i += 2) {
                                    tokenRefs.add(`${refs[i]}:${refs[i + 1]}`);
                                }
                            } else {
                                refs.forEach(ref => tokenRefs.add(ref));
                            }
                        });

                        if (groupRefs === null) {
                            groupRefs = tokenRefs;
                        } else {
                            groupRefs = new Set([...groupRefs].filter(x => tokenRefs.has(x)));
                        }
                    }

                    if (groupRefs) {
                        // For v5 indexes, we need to load paragraphs on-demand
                        const paragraphCache = new Map(); // fileId -> paragraphs array

                        // Load paragraphs for all unique files in this group
                        if (isV5) {
                            const uniqueFileIndices = new Set();
                            [...groupRefs].forEach(ref => {
                                const [docId] = ref.split(':');
                                uniqueFileIndices.add(parseInt(docId, 10));
                            });

                            const fileIndicesArray = [...uniqueFileIndices];
                            let loadedCount = 0;
                            const totalFiles = fileIndicesArray.length;

                            // Load files with progress tracking
                            await Promise.all(fileIndicesArray.map(async (fileIndex) => {
                                const fileId = indexData.f[fileIndex];
                                const paragraphs = await loadParagraphsForFile(fileId, sessionsById);
                                paragraphCache.set(fileIndex, paragraphs);

                                loadedCount++;
                                if (isMounted.current) {
                                    setSearchProgress(Math.floor((loadedCount / totalFiles) * 50)); // 0-50% for loading
                                }
                            }));

                            // Ensure we show 50% after verification loading completes
                            if (isMounted.current) {
                                setSearchProgress(50);
                            }
                        }

                        // Final verification: ensure the matching paragraph actually contains all of the search terms
                        // and phrases are adjacent
                        [...groupRefs].forEach(ref => {
                            const [docId, paraIndex] = ref.split(':');
                            let paragraph = null;
                            if (isV5) {
                                const fileIndex = parseInt(docId, 10);
                                const paragraphs = paragraphCache.get(fileIndex);
                                paragraph = paragraphs?.[parseInt(paraIndex, 10)];
                            } else if (isV3 || isV2 || isV4) {
                                const fileIndex = parseInt(docId, 10);
                                paragraph = indexData.d[fileIndex]?.[parseInt(paraIndex, 10)];
                            } else {
                                const doc = indexData.files[docId];
                                paragraph = doc?.paragraphs?.[parseInt(paraIndex, 10)];
                            }

                            if (paragraph) {
                                const paraText = paragraph.toLowerCase();
                                const isMatch = parsedAndClauses.every(clause => {
                                    if (clause.terms.length === 0) return true;
                                    if (clause.terms.length === 1) {
                                        const term = clause.terms[0];
                                        if (/^[a-z0-9]+$/i.test(term)) {
                                            const regex = new RegExp(`\\b${term}\\b`, 'i');
                                            return regex.test(paraText);
                                        }
                                        return paraText.includes(term);
                                    } else {
                                        // Phrase adjacency check
                                        // Escape terms for regex and join with anything non-alphanumeric
                                        const phraseRegexStr = clause.terms.map(t => {
                                            return t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                                        }).join('[^a-z0-9\u0590-\u05FF]+');

                                        const regex = new RegExp(`\\b${phraseRegexStr}\\b`, 'i');
                                        return regex.test(paraText);
                                    }
                                });

                                if (isMatch) {
                                    finalRefs.add(ref);
                                }
                            }
                        });
                    }
                }
            }

            // Group by doc
            const groupedResults = {};
            const libraryTags = LibraryStore.getRawState().tags;

            // Helper for capitalization
            const capitalize = (s) => {
                if (!s) return "";
                const str = String(s);
                if (str.toLowerCase() === "ai") return "AI";
                return str.charAt(0).toUpperCase() + str.slice(1);
            };

            // For v5, load paragraphs for all matched files
            const paragraphsMap = new Map(); // fileIndex -> paragraphs array

            if (isV5) {
                const uniqueFileIndices = new Set();
                [...finalRefs].forEach(ref => {
                    const [docId] = ref.split(':');
                    uniqueFileIndices.add(parseInt(docId, 10));
                });

                const fileIndicesArray = [...uniqueFileIndices];
                let loadedCount = 0;
                const totalFiles = fileIndicesArray.length;

                // Load files with progress tracking (50-100%)
                await Promise.all(fileIndicesArray.map(async (fileIndex) => {
                    const fileId = indexData.f[fileIndex];
                    const paragraphs = await loadParagraphsForFile(fileId, sessionsById);
                    paragraphsMap.set(fileIndex, paragraphs);

                    loadedCount++;
                    if (isMounted.current) {
                        setSearchProgress(50 + Math.floor((loadedCount / totalFiles) * 50)); // 50-100% for results
                    }
                }));

                // Ensure we show 100% after all loading completes
                if (isMounted.current) {
                    setSearchProgress(100);
                }
            }

            [...finalRefs].forEach(ref => {
                const [docId, paraIndex] = ref.split(':');

                if (!groupedResults[docId]) {
                    let doc = null;
                    if (isV3 || isV2 || isV4 || isV5) {
                        const fileIndex = parseInt(docId, 10);
                        const tagId = indexData.f[fileIndex];
                        const paragraphs = isV5 ? paragraphsMap.get(fileIndex) : indexData.d[fileIndex];

                        if (tagId.startsWith("session|")) {
                            if (sessions) {
                                const parts = tagId.split("|");
                                if (parts.length >= 5) {
                                    const session = sessionsById.get(tagId);
                                    if (session) {
                                        doc = {
                                            ...session,
                                            docId: tagId,
                                            isSession: true,
                                            customTags: [
                                                { label: "Group", value: capitalize(session.group) },
                                                { label: "Year", value: session.year },
                                                { label: "Date", value: session.date },
                                                { label: "Type", value: capitalize(session.type) }
                                            ],
                                            tag: { title: session.name, _id: tagId },
                                            paragraphs,
                                            matches: []
                                        };
                                    }
                                }
                            }
                        } else {
                            const tag = libraryTags.find(t => t._id === tagId);
                            if (tag) {
                                doc = {
                                    docId: tagId,
                                    tag,
                                    paragraphs,
                                    matches: []
                                };
                            }
                        }
                    } else {
                        const v1Doc = indexData.files[docId];
                        if (v1Doc) {
                            doc = {
                                ...v1Doc,
                                docId,
                                matches: []
                            };
                        }
                    }

                    if (doc) {
                        groupedResults[docId] = doc;
                    }
                }

                if (groupedResults[docId]) {
                    // Logic to handle empty query cases (filter only) where we want to show a summary
                    if (!query.trim() && groupedResults[docId].isSession) {
                        if (groupedResults[docId].matches.length === 0) {
                            let summaryText = groupedResults[docId].summary || groupedResults[docId].description;

                            // If we have no summary, or the summary matches the title, try to find a better one from paragraphs
                            const normalize = s => String(s).toLowerCase().replace(/[^a-z0-9]/g, "");
                            let useParagraphs = !summaryText;

                            if (summaryText && groupedResults[docId].tag) {
                                const pText = normalize(summaryText);
                                const tText = normalize(groupedResults[docId].tag.title);
                                // Check for match or substring (e.g. title "Foo", content "Foo - description")
                                if (pText === tText || pText.includes(tText) || tText.includes(pText)) {
                                    useParagraphs = true;
                                }
                            }

                            if (useParagraphs && groupedResults[docId].paragraphs && groupedResults[docId].paragraphs.length > 0) {
                                let found = false;
                                if (groupedResults[docId].tag) {
                                    const tText = normalize(groupedResults[docId].tag.title);
                                    for (const para of groupedResults[docId].paragraphs) {
                                        const pText = normalize(para);
                                        // Ignore empty paragraphs or paragraphs that are nearly identical to title
                                        if (pText && pText !== tText && !pText.includes(tText) && !tText.includes(pText)) {
                                            summaryText = para;
                                            found = true;
                                            break;
                                        }
                                        // RELAXED CHECK: If paragraph contains title but has significantly more content
                                        if (pText && pText.includes(tText) && pText.length > tText.length + 10) {
                                            summaryText = para;
                                            found = true;
                                            break;
                                        }
                                    }
                                }
                                if (!found) {
                                    if (!summaryText && groupedResults[docId].paragraphs.length > 0) {
                                        const p0 = groupedResults[docId].paragraphs[0];
                                        const tText = groupedResults[docId].tag ? normalize(groupedResults[docId].tag.title) : "";
                                        const p0Norm = normalize(p0);
                                        if (p0Norm !== tText && !p0Norm.includes(tText)) {
                                            summaryText = p0;
                                        }
                                    }
                                }
                            }

                            summaryText = summaryText || "";

                            // Set matches to this summary
                            groupedResults[docId].paragraphs = [summaryText];
                            groupedResults[docId].matches.push({
                                index: 0,
                                text: summaryText
                            });
                        }
                    } else {
                        // Standard search: add specific paragraph match
                        const idx = parseInt(paraIndex, 10);
                        if (groupedResults[docId].paragraphs && groupedResults[docId].paragraphs[idx]) {
                            groupedResults[docId].matches.push({
                                index: idx,
                                text: groupedResults[docId].paragraphs[idx]
                            });
                        }
                    }
                }
            });

            // Sort paragraphs within docs
            const normalize = s => String(s).toLowerCase().replace(/[^a-z0-9]/g, "");

            Object.values(groupedResults).forEach(doc => {
                doc.matches.sort((a, b) => a.index - b.index);

                // Post-processing for Sessions:
                // 1. Remove match if it is just the Title (redundant)
                // 2. Adjust remaining indices if we removed top one, so it looks nice (starts from 1)
                if (doc.isSession && doc.tag && doc.matches.length > 0) {
                    const tText = normalize(doc.tag.title);
                    // Check first match (usually Title is index 0)
                    const m0 = doc.matches[0];
                    if (m0.index === 0) {
                        const pText = normalize(m0.text);
                        // If first match IS the title (or subset), remove it
                        if (pText === tText || pText.includes(tText) || tText.includes(pText)) {
                            doc.matches.shift();

                            // If we removed all matches, add a fallback match using next paragraph
                            if (doc.matches.length === 0 && doc.paragraphs && doc.paragraphs.length > 1) {
                                doc.matches.push({
                                    index: 1,
                                    text: doc.paragraphs[1]
                                });
                            }
                        }
                    }
                }
            });

            // Filter out documents with no matches
            const filteredResults = Object.values(groupedResults).filter(doc => doc.matches.length > 0);

            if (isMounted.current) {
                const uniqueTerms = [...new Set(searchTerms)];
                ResearchStore.update(s => {
                    s.results = filteredResults;
                    s.highlight = uniqueTerms;
                    s.hasSearched = true;
                });
                if (!isRestoring && listRef.current) {
                    listRef.current.scrollToItem(0, "start");
                }
            }
        } catch (err) {
            console.error("Search failed:", err);
        } finally {
            if (isMounted.current) {
                setSearching(false);
                setSearchProgress(100);
                // Keep progress bar visible briefly to show 100% completion
                setTimeout(() => {
                    if (isMounted.current) {
                        setShowProgress(false);
                    }
                }, 500);
                if (searchTimer.current) {
                    clearTimeout(searchTimer.current);
                    searchTimer.current = null;
                }
            }
        }
    }, [indexData, query, setResults, filterTags, sessions, sessionsById]);

    // Only auto-search on initial page load if there's a saved query from localStorage
    const initialSearchDone = useRef(false);
    const prevSessionCount = useRef(0);

    useEffect(() => {
        if (!_loaded) {
            return;
        }

        // If sessions updated (length changed), re-run search to ensure we have all results
        if (sessions && sessions.length !== prevSessionCount.current) {
            prevSessionCount.current = sessions.length;
            // Force re-search if we already ran one
            if (initialSearchDone.current && indexData) {
                handleSearch(true);
            }
        }

        if (initialSearchDone.current) {
            return;
        }
        // Trigger search if there's a query OR if there are filter tags
        if (!query && !filterTags.length) {
            initialSearchDone.current = true;
            return;
        }
        if (indexData) {
            initialSearchDone.current = true;
            if (!hasSearched && !searching) {
                handleSearch(true);
            }
        }
    }, [_loaded, indexData, hasSearched, searching, handleSearch, query, sessions, filterTags.length]);

    const handleClear = useCallback(() => {
        setQuery("");
        setFilterTags([]);
        setFilterInput("");
        ResearchStore.update(s => {
            s.results = [];
            s.highlight = [];
            s.hasSearched = false;
        });
        setAppliedFilterTags([]);
    }, [setQuery, setFilterTags, setFilterInput, setAppliedFilterTags]);

    const onKeyDown = (e) => {
        if (e.key === 'Enter') {
            handleSearch();
        }
    };

    const gotoArticle = (tag, paragraphId) => {
        if (tag._id && tag._id.startsWith("session|")) {
            const parts = tag._id.split("|");
            if (parts.length >= 5) {
                const group = parts[1];
                const year = parts[2];
                const date = parts[3];
                const name = parts.slice(4).join("|");
                setHash(`session?group=${group}&year=${year}&date=${date}&name=${encodeURIComponent(name)}`);
            }
            return;
        }
        const hierarchy = getTagHierarchy(tag);
        if (hierarchy.length > 0) {
            setPath("library", ...hierarchy);
            if (paragraphId !== undefined) {
                LibraryStore.update(s => {
                    s.scrollToParagraph = paragraphId;
                });
            }
        }
    };

    const filteredResults = useMemo(() => {
        let res;
        if (!appliedFilterTags.length) {
            res = results;
        } else {
            res = results.filter(doc => {
                return appliedFilterTags.every(filter => {
                    const filterLabel = typeof filter === 'string' ? filter : filter.label;
                    const filterType = typeof filter === 'string' ? null : filter.type;

                    if (filterType === "source") {
                        if (filterLabel === translations.SESSIONS) return doc.isSession;
                        if (filterLabel === translations.ARTICLES) return !doc.isSession;
                        if (filterLabel === translations.SUMMARIES) return doc.isSession && (!!doc.summaryText || !!doc.summary);
                        if (filterLabel === translations.TRANSCRIPTIONS) return doc.isSession && !!doc.transcription;
                    }

                    if (doc.isSession) {
                        const filterLabelStr = String(filterLabel).toLowerCase();
                        if (filterType === "group" && String(doc.group).toLowerCase() === filterLabelStr) return true;
                        if (filterType === "year" && String(doc.year) === filterLabel) return true;
                        if (filterType === "date" && doc.date === filterLabel) return true;
                        if (filterType === "type" && String(doc.type).toLowerCase() === filterLabelStr) return true;
                        return false;
                    } else {
                        // For non-session docs, we might want to check exact match or similar logic?
                        // But original logic was:
                        // return doc.group === filterLabel || ...
                        // We should probably safeguard this too if tags are capitalized in UI but not in doc.
                        // But library tags usually match ID or Label directly.
                        if (filterType && doc.tag?.[filterType]) {
                            return String(doc.tag[filterType]).toLowerCase() === String(filterLabel).toLowerCase();
                        }
                        // This handles the case where filter is a string (no filterType) or filterType is not a direct tag property
                        return LibraryTagKeys.some(key => {
                            const val = doc.tag?.[key];
                            return val && String(val).trim().toLowerCase() === String(filterLabel).toLowerCase();
                        });
                    }
                    const val = doc.tag?.[filterType];
                    return val && String(val).trim() === filterLabel;
                });
            });
        }
        return res;
    }, [results, appliedFilterTags, translations]);

    const pathItems = usePathItems();

    const matchCounts = useMemo(() => {
        let sum = 0;
        return filteredResults.map(doc => {
            const count = doc.matches?.length || 0;
            const start = sum + 1;
            sum += count;
            return { start, count, total: sum };
        });
    }, [filteredResults]);

    const totalMatches = matchCounts.length > 0 ? matchCounts[matchCounts.length - 1].total : 0;

    const handleJumpSubmit = useCallback((type, value) => {
        setJumpOpen(false);
        isJumping.current = true;
        initialUrlHandled.current = true;
        if (jumpTimeout.current) clearTimeout(jumpTimeout.current);

        if (type === 'page' && listRef.current) {
            const index = value - 1;
            if (index >= 0 && index < filteredResults.length) {
                listRef.current.scrollToItem(index, "start");
            }
        } else if (type === 'paragraph' && listRef.current) {
            // "Paragraph" in Research context is "Match number" across all results
            const matchIndex = value;
            const docIndex = matchCounts.findIndex(m => matchIndex >= m.start && matchIndex <= m.total);
            if (docIndex !== -1) {
                listRef.current.scrollToItem(docIndex, "start");
                // Also scroll within the article if needed
                const doc = filteredResults[docIndex];
                const matchInDoc = doc.matches.find(m => (matchCounts[docIndex].start + doc.matches.indexOf(m)) === matchIndex);
                if (matchInDoc) {
                    LibraryStore.update(s => {
                        s.scrollToParagraph = matchInDoc.index + 1;
                    });
                }
            }
        }

        jumpTimeout.current = setTimeout(() => {
            isJumping.current = false;
        }, 1000);
    }, [filteredResults, matchCounts]);

    useEffect(() => {
        if (filteredResults.length > 0) {
            const path = pathItems[0];
            const lastPart = path?.split(":")[1];
            if (pathItems.length === 1 && path?.startsWith("research") && lastPart) {
                if (path === pendingPathRef.current) {
                    pendingPathRef.current = null;
                    return;
                }
                pendingPathRef.current = null;

                const articleNumber = parseInt(lastPart, 10);
                const index = articleNumber - 1;
                if (!isNaN(index) && index >= 0 && index < filteredResults.length) {
                    if (currentPageRef.current !== articleNumber) {
                        isJumping.current = true;
                        if (jumpTimeout.current) clearTimeout(jumpTimeout.current);
                        listRef.current.scrollToItem(index, "start");
                        jumpTimeout.current = setTimeout(() => {
                            isJumping.current = false;
                            initialUrlHandled.current = true;
                        }, 1000);
                        return;
                    }
                }
            }
            initialUrlHandled.current = true;
        }
    }, [pathItems, filteredResults]);

    const getItemSize = useCallback((index) => {
        if (rowHeights.current[index]) return rowHeights.current[index];
        const doc = filteredResults[index];
        const matchCount = doc?.matches?.length || 1;
        // More generous initial estimate to avoid initial clipping
        return 400 + (matchCount * 200);
    }, [filteredResults]);

    useEffect(() => {
        rowHeights.current = {};
        if (listRef.current) {
            listRef.current.resetAfterIndex(0);
        }
    }, [filteredResults]);

    const scrollToTop = useCallback(() => {
        if (listRef.current) {
            listRef.current.scrollToItem(0, "start");
        }
    }, [listRef]);

    const toolbarItems = useMemo(() => [
        {
            id: "toggleSearch",
            name: searchCollapsed ? translations.SHOW_SEARCH : translations.HIDE_SEARCH,
            active: !searchCollapsed,
            icon: <SearchIcon />,
            onClick: () => setSearchCollapsed(prev => !prev),
            location: "header"
        },
        isAdmin && {
            id: "rebuildIndex",
            name: translations.REBUILD_INDEX,
            icon: <RefreshIcon />,
            onClick: buildIndex,
            disabled: indexing,
            location: "header"
        },
        {
            id: "jump",
            name: translations.JUMP_TO_ARTICLE,
            icon: <FormatListNumberedIcon />,
            onClick: () => setJumpOpen(true),
            location: "header"
        },
        {
            id: "print",
            name: translations.PRINT,
            icon: <PrintIcon />,
            onClick: handlePrint,
            location: "header"
        }
    ], [translations, buildIndex, indexing, searchCollapsed, handlePrint, isAdmin]);

    useToolbar({ id: "Research", items: toolbarItems, depends: [toolbarItems] });

    return (
        <Box className={styles.root}>
            {!searchCollapsed && (
                <Paper className={[styles.searchPaper, isMobile && searchCollapsed && styles.searchPaperCollapsed].join(" ")}>
                    <Box className={styles.searchHeader}>
                        <TextField
                            fullWidth
                            placeholder={translations.SEARCH_ARTICLES}
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyDown={onKeyDown}
                            variant="outlined"
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <SearchIcon />
                                    </InputAdornment>
                                ),
                                endAdornment: query && (
                                    <InputAdornment position="end">
                                        <IconButton onClick={handleClear} size="small">
                                            <ClearIcon fontSize="small" />
                                        </IconButton>
                                    </InputAdornment>
                                )
                            }}
                            className={styles.queryField}
                        />
                        <Button
                            variant="contained"
                            onClick={handleSearch}
                            disabled={indexing || searching || !indexData}
                            className={styles.searchButton}
                        >
                            {translations.SEARCH}
                        </Button>
                    </Box>

                    {!searchCollapsed && (
                        <Box className={styles.filterContainer}>
                            <Autocomplete
                                multiple
                                className={styles.autocomplete}
                                options={availableFilters.filter(option => !filterTags.some(tag => tag.label === option.label && tag.type === option.type))}
                                inputValue={filterInput}
                                onInputChange={(event, newInputValue) => {
                                    setFilterInput(newInputValue);
                                }}
                                filterOptions={(options, { inputValue }) => {
                                    const lowerInput = inputValue.toLowerCase().trim();
                                    if (!lowerInput) return options;
                                    return options.filter(option => {
                                        const label = (option.label || "").toLowerCase();
                                        const type = (option.type || "").toLowerCase();
                                        const translatedType = (translations[option.type?.toUpperCase()] || "").toLowerCase();
                                        return label.includes(lowerInput) || type.includes(lowerInput) || translatedType.includes(lowerInput);
                                    });
                                }}
                                isOptionEqualToValue={(option, value) => {
                                    return option.label === value.label && option.type === value.type;
                                }}
                                getOptionLabel={(option) => typeof option === 'string' ? option : option.label}
                                renderOption={(props, option) => {
                                    const { key: _key, ...otherProps } = props;
                                    return (
                                        <li key={`${option.type}-${option.label}`} {...otherProps}>
                                            <Typography variant="caption" sx={{ fontWeight: 'bold', mr: 1, color: 'text.secondary', textTransform: 'capitalize', width: '85px', display: 'inline-block', flexShrink: 0 }}>
                                                {translations[option.type.toUpperCase()] || option.type}
                                            </Typography>
                                            {option.label}
                                        </li>
                                    );
                                }}
                                value={filterTags}
                                onChange={(event, newValue) => {
                                    setFilterTags(newValue);
                                    setFilterInput("");
                                }}
                                renderTags={(value, getTagProps) =>
                                    value.map((option, index) => {
                                        const { key, ...tagProps } = getTagProps({ index });
                                        const label = typeof option === 'string' ? option : option.label;
                                        const type = typeof option === 'string' ? "" : (translations[option.type.toUpperCase()] || option.type);
                                        return (
                                            <Box key={key} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mr: 0.5, my: 0.5 }}>
                                                {type && (
                                                    <Typography variant="caption" sx={{ fontSize: '0.65rem', color: 'text.secondary', mt: 0.25, textTransform: 'capitalize', fontWeight: 'bold' }}>
                                                        {type}
                                                    </Typography>
                                                )}
                                                <Chip variant="outlined" label={label} size="small" {...tagProps} />
                                            </Box>
                                        );
                                    })
                                }
                                renderInput={(params) => (
                                    <TextField
                                        {...params}
                                        variant="outlined"
                                        placeholder={translations.TAG}
                                        size="small"
                                    />
                                )}
                            />
                        </Box>
                    )}
                </Paper>
            )}



            {showProgress && (
                <Box className={styles.progressContainer}>
                    <Typography variant="caption">{translations.SEARCHING}</Typography>
                    <LinearProgress variant="determinate" value={searchProgress} />
                </Box>
            )}

            {indexing && (
                <Box className={styles.overlay}>
                    <Paper className={styles.overlayContent}>
                        <Typography variant="h6" gutterBottom>{status || translations.INDEXING}</Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                            <Box sx={{ width: '100%', mr: 2 }}>
                                <LinearProgress variant="determinate" value={progress} />
                            </Box>
                            <Box sx={{ minWidth: 45 }}>
                                <Typography variant="body2" color="text.secondary">{`${Math.round(progress)}%`}</Typography>
                            </Box>
                        </Box>
                    </Paper>
                </Box>
            )}

            {hasSearched && filteredResults.length === 0 && !indexing && (
                <Box className={styles.noResults}>
                    <Typography>
                        {translations.NO_RESULTS}
                    </Typography>
                </Box>
            )}

            {hasSearched && filteredResults.length > 0 && (
                <Box className={styles.resultsWrapper}>
                    <VariableSizeList
                        height={size.height - (isMobile ? (searchCollapsed ? 40 : 180) : (searchCollapsed ? 50 : 200))} // Adjust for header/search bar
                        itemCount={filteredResults.length}
                        itemSize={getItemSize}
                        estimatedItemSize={500}
                        width={size.width - 32} // Account for root padding
                        ref={listRef}
                        outerRef={outerRef}
                        onItemsRendered={({ visibleStartIndex }) => {
                            const page = visibleStartIndex + 1;
                            const count = filteredResults.length;
                            setScrollPages(prev => {
                                if (prev.page === page && prev.count === count && prev.visible === true) return prev;
                                return { ...prev, page, count, visible: true };
                            });

                            const currentPath = `research:${page}`;
                            if (!isJumping.current && pathItems[0] !== currentPath && initialUrlHandled.current) {
                                pendingPathRef.current = currentPath;
                                setPath(currentPath);
                            }

                            if (scrollTimeoutRef.current) {
                                clearTimeout(scrollTimeoutRef.current);
                            }
                            scrollTimeoutRef.current = setTimeout(() => {
                                setScrollPages(prev => ({ ...prev, visible: false }));
                            }, 1500);

                            if (isMobile) {
                                setSearchCollapsed(visibleStartIndex > 0);
                            }
                            setShowScrollTop(visibleStartIndex > 0);
                        }}
                        itemData={{
                            results: filteredResults,
                            gotoArticle,
                            setRowHeight,
                            listRef,
                            highlight
                        }}
                    >
                        {SearchResultItem}
                    </VariableSizeList>
                    <ScrollToTop show={showScrollTop} onClick={scrollToTop} translations={translations} />
                    <PageIndicator
                        current={scrollPages.page}
                        total={scrollPages.count}
                        visible={scrollPages.visible}
                        translations={translations}
                        label={translations.ARTICLE}
                    />
                </Box>
            )}

            {useEffect(() => {
                if (hasSearched && filteredResults.length > 0) {
                    setScrollPages(prev => ({ ...prev, visible: true }));
                    if (scrollTimeoutRef.current) {
                        clearTimeout(scrollTimeoutRef.current);
                    }
                    scrollTimeoutRef.current = setTimeout(() => {
                        setScrollPages(prev => ({ ...prev, visible: false }));
                    }, 1500);
                }
            }, [hasSearched, filteredResults]) || null}



            <JumpDialog
                open={jumpOpen}
                onClose={() => setJumpOpen(false)}
                onSubmit={handleJumpSubmit}
                maxPage={filteredResults.length}
                maxParagraphs={totalMatches}
                pageLabel={translations.ARTICLE}
                pageNumberLabel={translations.ARTICLE_NUMBER}
                paragraphLabel={translations.MATCH}
                paragraphNumberLabel={translations.MATCH_NUMBER}
                title={translations.JUMP_TO_ARTICLE}
            />

            {printRoot && createPortal(
                <div className={styles.printContainer}>
                    {printing && filteredResults.map((doc, index) => (
                        <div key={doc.docId || index} className={styles.printItem}>
                            <Article
                                selectedTag={doc.tag}
                                content={doc.text ? normalizeContent(doc.text) : (doc.paragraphs ? doc.paragraphs.join("\n\n") : "")}
                                filteredParagraphs={doc.matches?.map(m => m.index + 1) || []}
                                embedded={true}
                                hidePlayer={true}
                                highlight={highlight}
                            />
                        </div>
                    ))}
                </div>,
                printRoot
            )}
        </Box>
    );
}


