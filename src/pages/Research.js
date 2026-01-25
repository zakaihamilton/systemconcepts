import React, { useState, useEffect, useCallback, useRef, useMemo, useContext } from "react";
import ReactDOM from "react-dom";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import LinearProgress from "@mui/material/LinearProgress";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import InputAdornment from "@mui/material/InputAdornment";
import SearchIcon from "@mui/icons-material/Search";
import RefreshIcon from "@mui/icons-material/Refresh";
import ClearIcon from "@mui/icons-material/Clear";
import IconButton from "@mui/material/IconButton";
import Autocomplete from "@mui/material/Autocomplete";
import Chip from "@mui/material/Chip";
import Paper from "@mui/material/Paper";
import Fade from "@mui/material/Fade";
import PrintIcon from "@mui/icons-material/Print";
import FormatListNumberedIcon from "@mui/icons-material/FormatListNumbered";
import JumpDialog from "@pages/Library/Article/JumpDialog";

import { makePath } from "@util/path";
import storage from "@util/storage";
import { SyncActiveStore } from "@sync/syncState";
import { LIBRARY_LOCAL_PATH } from "@sync/constants";
import { useTranslations } from "@util/translations";
import { setPath } from "@util/pages";
import styles from "./Research.module.scss";
import { LibraryTagKeys } from "@pages/Library/Icons";
import { useToolbar, registerToolbar } from "@components/Toolbar";
import { LibraryStore } from "@pages/Library/Store";
import { Store } from "pullstate";
import Article from "@pages/Library/Article";
import Header from "@pages/Library/Article/Header";
import { ContentSize } from "@components/Page/Content";
import { VariableSizeList } from "react-window";
import { useDeviceType } from "@util/styles";
import { useLocalStorage } from "@util/store";
import ScrollToTop from "@pages/Library/Article/ScrollToTop";

registerToolbar("Research");

const INDEX_FILE = "search_index.json";

export const ResearchStore = new Store({
    query: "",
    filterTags: [],
    results: [],
    highlight: [],
    hasSearched: false,
    _loaded: false
});

function getTagHierarchy(tag) {
    const hierarchy = LibraryTagKeys.map(key => tag[key]).map(v => v ? String(v).trim() : null).filter(Boolean);
    if (tag.number && hierarchy.length > 0) {
        hierarchy[hierarchy.length - 1] = `${hierarchy[hierarchy.length - 1]}:${tag.number}`;
    }
    return hierarchy;
}

function getArticleTitle(tag) {
    if (!tag) return { name: "Untitled", key: "" };
    for (let i = LibraryTagKeys.length - 1; i >= 0; i--) {
        const key = LibraryTagKeys[i];
        const value = tag[key];
        if (value && String(value).trim()) {
            return { name: value, key };
        }
    }
    return { name: "Untitled", key: "" };
}

registerToolbar("Research");

const normalizeContent = (text) => {
    // Split by code blocks to protect them from normalization
    const parts = text.split(/(```[\s\S]*?```)/g);
    console.log(`[Research] NormalizeContent running on text length ${text.length}`);

    return parts.map(part => {
        if (part.startsWith('```')) return part;

        let processed = part.replace(/\r\n/g, "\n");
        // Convert single newlines to double to ensure granular paragraphs
        processed = processed.replace(/\n+/g, (match) => match.length === 1 ? "\n\n" : match);

        // Ensure headers are followed by double newlines to match indexing split
        processed = processed.replace(/^[ \t]*(?!#|-|\*|\d)([A-Z].*?)[ \t]*(\r?\n)/gm, (match, line, newline) => {
            const trimmed = line.trim();
            if (!trimmed) return match;
            if (trimmed.endsWith('.')) return match;
            if (trimmed.endsWith(';')) return match;
            if (trimmed.endsWith(',')) return match;
            if (trimmed.length > 120) return match;
            return `### ${trimmed}\n\n`;
        });
        return processed;
    }).join("");
};


export default function Research() {
    const translations = useTranslations();
    const { query, filterTags, results, hasSearched, _loaded, highlight } = ResearchStore.useState();
    const [indexing, setIndexing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [status, setStatus] = useState("");
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
    const [scrollPages, setScrollPages] = useState({ current: 1, total: 1, visible: false });
    const scrollTimeoutRef = useRef(null);
    const [lastSearch, setLastSearch] = useState({ query: "", filterTags: [] });
    const [jumpDialogOpen, setJumpDialogOpen] = useState(false);
    const [appliedFilterTags, setAppliedFilterTags] = useState([]);
    const [searchCollapsed, setSearchCollapsed] = useState(false);
    const [showScrollTop, setShowScrollTop] = useState(false);
    const [printing, setPrinting] = useState(false);

    useLocalStorage("ResearchStore", ResearchStore, ["query", "filterTags"]);

    const setRowHeight = useCallback((index, height) => {
        if (rowHeights.current[index] !== height) {
            rowHeights.current[index] = height;
            if (listRef.current) {
                listRef.current.resetAfterIndex(index);
            }
        }
    }, []);


    useEffect(() => {
        if (_loaded) {
            setAppliedFilterTags(filterTags);
        }
    }, [_loaded]); // eslint-disable-line react-hooks/exhaustive-deps

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
                        if (tag[key]) unique.add(String(tag[key]).trim());
                    });
                });
                if (isMounted.current) {
                    setAvailableFilters(Array.from(unique).sort());
                }
            }
        } catch (err) {
            console.error("Failed to load tags for filters:", err);
        }
    }, []);

    const buildIndex = useCallback(async () => {
        if (indexing) return;
        setIndexing(true);
        setProgress(0);
        setStatus(translations.LOADING_TAGS);

        try {
            const tagsPath = makePath(LIBRARY_LOCAL_PATH, "tags.json");
            if (!await storage.exists(tagsPath)) {
                setStatus("No tags found.");
                setIndexing(false);
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
                setProgress(progressVal);

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
                                    if (/^\d+\.\s/.test(firstLine)) return 'ol';
                                    if (/^>\s/.test(firstLine)) return 'quote';
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
                setIndexData(newIndex);
                setStatus(translations.DONE);
            }

        } catch (err) {
            console.error("Indexing failed:", err);
            if (isMounted.current) setStatus("Indexing failed");
        } finally {
            if (isMounted.current) {
                setIndexing(false);
                setTimeout(() => setStatus(""), 2000);
            }
        }

    }, [indexing, translations]);

    const loadIndex = useCallback(async () => {
        try {
            const indexPath = makePath(LIBRARY_LOCAL_PATH, INDEX_FILE);
            if (await storage.exists(indexPath)) {
                const content = await storage.readFile(indexPath);
                const data = JSON.parse(content);
                if (isMounted.current) {
                    setIndexData(data);
                }
            } else {
                // Auto-build if not exists
                buildIndex();
            }
        } catch (err) {
            console.error("Failed to load search index:", err);
        }
    }, [buildIndex]);

    useEffect(() => {
        loadTags();
        loadIndex();
    }, [loadTags, loadIndex]);

    useEffect(() => {
        if (libraryUpdateCounter > 0) {
            loadIndex();
            loadTags();
        }
    }, [libraryUpdateCounter, loadIndex, loadTags]);

    const handleSearch = useCallback(async () => {
        const currentSearch = { query, filterTags };
        setLastSearch(currentSearch);
        setAppliedFilterTags(filterTags);
        if (!indexData || !query.trim()) {
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
            const groups = query.split(/\s+OR\s+/).map(g => g.trim()).filter(Boolean);
            const searchTerms = [];
            let finalRefs = new Set(); // Stores "docId:paraIndex"

            const totalSteps = groups.reduce((acc, g) => acc + g.split(/\s+/).filter(t => t !== "AND" && t !== "OR").length, 0) + 1;
            let currentStep = 0;

            for (const group of groups) {
                const groupTerms = group.split(/\s+/).filter(t => t !== "AND" && t !== "OR").map(t => t.toLowerCase());
                if (groupTerms.length === 0) continue;
                searchTerms.push(...groupTerms);

                let groupRefs = null;

                for (const term of groupTerms) {
                    if (!isMounted.current) return;

                    const matchingTokens = Object.keys(indexData.tokens).filter(k => k.includes(term));
                    let termRefs = new Set();
                    matchingTokens.forEach(k => {
                        indexData.tokens[k].forEach(ref => termRefs.add(ref));
                    });

                    if (groupRefs === null) {
                        groupRefs = termRefs;
                    } else {
                        groupRefs = new Set([...groupRefs].filter(x => termRefs.has(x)));
                    }

                    currentStep++;
                    setSearchProgress((currentStep / totalSteps) * 100);
                    await new Promise(resolve => setTimeout(resolve, 0));
                }

                if (groupRefs) {
                    // Final verification: ensure the matching paragraph actually contains all of the search terms
                    const verifiedRefs = new Set();
                    [...groupRefs].forEach(ref => {
                        const [docId, paraIndex] = ref.split(':');
                        const doc = indexData.files[docId];
                        const paragraph = doc?.paragraphs?.[parseInt(paraIndex, 10)];
                        if (paragraph) {
                            const paraText = paragraph.toLowerCase();
                            const isMatch = groupTerms.every(term => {
                                if (/^[a-z0-9]+$/i.test(term)) {
                                    const regex = new RegExp(`\\b${term}\\b`, 'i');
                                    return regex.test(paraText);
                                }
                                return paraText.includes(term);
                            });

                            if (isMatch) {
                                console.log(`[Research] Match CONFIRMED: Doc ${docId} Para ${paraIndex}. Text: "${paraText.substring(0, 50)}..." Terms: ${groupTerms}`);
                                verifiedRefs.add(ref);
                            } else {
                                console.log(`[Research] False positive filtered: Doc ${docId} Para ${paraIndex}. Text: "${paraText.substring(0, 50)}..." Terms: ${groupTerms}`);
                            }
                        } else {
                            console.warn(`[Research] Missing paragraph for ref ${ref}`);
                        }
                    });

                    verifiedRefs.forEach(ref => finalRefs.add(ref));
                }
            }

            // Group by doc
            const groupedResults = {};
            [...finalRefs].forEach(ref => {
                const [docId, paraIndex] = ref.split(':');
                if (!groupedResults[docId]) {
                    const doc = indexData.files[docId];
                    if (doc) {
                        groupedResults[docId] = {
                            ...doc,
                            docId,
                            matches: []
                        };
                    }
                }
                if (groupedResults[docId]) {
                    groupedResults[docId].matches.push({
                        index: parseInt(paraIndex, 10),
                        text: indexData.files[docId].paragraphs[parseInt(paraIndex, 10)]
                    });
                }
            });

            // Sort paragraphs within docs
            Object.values(groupedResults).forEach(doc => {
                doc.matches.sort((a, b) => a.index - b.index);
            });

            if (isMounted.current) {
                const uniqueTerms = [...new Set(searchTerms)];
                const resultsWithTerms = Object.values(groupedResults);
                ResearchStore.update(s => {
                    s.results = resultsWithTerms;
                    s.highlight = uniqueTerms;
                    s.hasSearched = true;
                });
            }
        } catch (err) {
            console.error("Search failed:", err);
        } finally {
            if (isMounted.current) {
                setSearching(false);
                setSearchProgress(100);
                setShowProgress(false);
                if (searchTimer.current) {
                    clearTimeout(searchTimer.current);
                    searchTimer.current = null;
                }
            }
        }

    }, [indexData, query, setResults, filterTags]);

    // Only auto-search on initial page load if there's a saved query from localStorage
    const initialSearchDone = useRef(false);
    useEffect(() => {
        if (_loaded && query && indexData && !hasSearched && !searching && !initialSearchDone.current) {
            initialSearchDone.current = true;
            handleSearch();
        }
    }, [_loaded, indexData, hasSearched, searching, handleSearch, query]);

    const handleClear = useCallback(() => {
        setQuery("");
        ResearchStore.update(s => {
            s.results = [];
            s.highlight = [];
            s.hasSearched = false;
        });
        setAppliedFilterTags([]);
    }, [setQuery]);

    const onKeyDown = (e) => {
        if (e.key === 'Enter') {
            handleSearch();
        }
    };

    const gotoArticle = (tag, paragraphId) => {
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
                    return LibraryTagKeys.some(key => doc.tag[key] === filter);
                });
            });
        }
        return res;
    }, [results, appliedFilterTags]);

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

    useEffect(() => {
        if (printing) {
            const timer = setTimeout(() => {
                // Ensure we listen for cleanup BEFORE printing
                // This ensures we catch the event even if print() blocks synchronously
                const cleanup = () => {
                    setPrinting(false);
                    window.removeEventListener("afterprint", cleanup);
                };
                window.addEventListener("afterprint", cleanup);

                // Fallback: if afterprint doesn't fire (e.g. some browsers), reset anyway after a delay
                // preventing the app from getting stuck in "print mode"
                setTimeout(() => {
                    setPrinting(false);
                    window.removeEventListener("afterprint", cleanup);
                }, 5000);

                window.print();
            }, 500); // Short delay to allow render
            return () => clearTimeout(timer);
        }
    }, [printing]);

    const handlePrint = useCallback(() => {
        setPrinting(true);
    }, []);

    const handleJump = useCallback((type, value) => {
        setJumpDialogOpen(false);
        if (type === 'page' && listRef.current) {
            listRef.current.scrollToItem(value - 1, "start");
        }
    }, [listRef]);

    const scrollToTop = useCallback(() => {
        if (listRef.current) {
            listRef.current.scrollToItem(0, "start");
        }
    }, [listRef]);

    const toolbarItems = useMemo(() => [
        {
            id: "rebuildIndex",
            name: translations.REBUILD_INDEX,
            icon: <RefreshIcon />,
            onClick: buildIndex,
            disabled: indexing,
            location: "header"
        },
        {
            id: "jumpTo",
            name: translations.JUMP_TO,
            icon: <FormatListNumberedIcon />,
            onClick: () => setJumpDialogOpen(true),
            disabled: !hasSearched || filteredResults.length === 0,
            location: "header"
        },
        {
            id: "print",
            name: translations.PRINT || "Print",
            icon: <PrintIcon />,
            onClick: handlePrint,
            disabled: !hasSearched || filteredResults.length === 0,
            location: "header"
        }
    ], [translations, buildIndex, indexing, hasSearched, filteredResults.length, handlePrint]);

    useToolbar({ id: "Research", items: toolbarItems, depends: [toolbarItems] });

    return (
        <Box className={styles.root}>
            {(!isMobile || !searchCollapsed) && (
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
                            disabled={indexing || searching || !indexData || (query === lastSearch.query && JSON.stringify(filterTags) === JSON.stringify(lastSearch.filterTags))}
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
                                options={availableFilters}
                                freeSolo
                                value={filterTags}
                                onChange={(event, newValue) => {
                                    setFilterTags(newValue);
                                }}
                                renderTags={(value, getTagProps) =>
                                    value.map((option, index) => {
                                        const { key, ...tagProps } = getTagProps({ index });
                                        return <Chip variant="outlined" label={option} key={key} {...tagProps} />;
                                    })
                                }
                                renderInput={(params) => (
                                    <TextField
                                        {...params}
                                        variant="outlined"
                                        label={translations.FILTER_BY_TAGS}
                                        placeholder={translations.TAG}
                                        size="small"
                                    />
                                )}
                            />
                        </Box>
                    )}
                </Paper>
            )}

            {indexing && (
                <Box className={styles.progressContainer}>
                    <Typography variant="caption">{status}</Typography>
                    <LinearProgress variant="determinate" value={progress} />
                </Box>
            )}

            {showProgress && (
                <Box className={styles.progressContainer}>
                    <Typography variant="caption">{translations.SEARCHING}</Typography>
                    <LinearProgress variant="determinate" value={searchProgress} />
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
                        height={size.height - (isMobile ? (searchCollapsed ? 40 : 180) : 200)} // Adjust for header/search bar
                        itemCount={filteredResults.length}
                        itemSize={getItemSize}
                        estimatedItemSize={500}
                        width={size.width - 32} // Account for root padding
                        ref={listRef}
                        outerRef={outerRef}
                        onItemsRendered={({ visibleStartIndex }) => {
                            const current = visibleStartIndex + 1;
                            const total = filteredResults.length;
                            setScrollPages(prev => ({ ...prev, current, total, visible: true }));

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
                        current={scrollPages.current}
                        total={scrollPages.total}
                        visible={scrollPages.visible}
                        translations={translations}
                        label={translations.ARTICLE}
                    />
                    <JumpDialog
                        open={jumpDialogOpen}
                        onClose={() => setJumpDialogOpen(false)}
                        onSubmit={handleJump}
                        maxPage={scrollPages.total}
                        maxParagraphs={0}
                        title={translations.JUMP_TO_ARTICLE || "Jump to Article"}
                        pageLabel={translations.ARTICLE}
                        pageNumberLabel={translations.ARTICLE_NUMBER}
                    />
                    {printing && ReactDOM.createPortal(
                        <div id="print-root" className={styles.printContainer}>
                            {filteredResults.map((doc, index) => {
                                const content = normalizeContent(doc.text);
                                const filteredParagraphs = doc.matches.map(m => m.index + 1);
                                const title = getArticleTitle(doc.tag);
                                return (
                                    <div key={doc.tag._id || index} className={styles.printItem}>
                                        <Header
                                            selectedTag={doc.tag}
                                            isHeaderHidden={false}
                                            showAbbreviations={false}
                                            title={title}
                                            currentParagraphIndex={-2}
                                        />
                                        <div className={styles.printContent}>
                                            <Article
                                                selectedTag={doc.tag}
                                                content={content}
                                                filteredParagraphs={filteredParagraphs}
                                                embedded={true}
                                                hidePlayer={true}
                                                hideHeader={true}
                                                highlight={highlight}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>,
                        document.body
                    )}
                </Box>
            )}
        </Box>
    );
}

const PageIndicator = React.memo(({ current, total, visible, translations, label }) => {
    return (
        <Fade in={visible} timeout={1000}>
            <Paper
                elevation={4}
                className={["print-hidden", styles.pageIndicator].join(" ")}
            >
                <Typography variant="body2" className={styles.pageIndicatorText}>
                    {label || translations.PAGE || "Page"} {current} / {total}
                </Typography>
            </Paper>
        </Fade>
    );
});
PageIndicator.displayName = "PageIndicator";

const SearchResultItem = ({ index, style, data }) => {
    const { results, gotoArticle, setRowHeight, highlight } = data || {};
    const doc = results ? results[index] : null;
    const rowRef = useRef(null);

    useEffect(() => {
        if (rowRef.current && setRowHeight) {
            const observer = new ResizeObserver((entries) => {
                for (let entry of entries) {
                    const rect = entry.target.getBoundingClientRect();
                    const height = rect.height;
                    if (height > 0) {
                        setRowHeight(index, height);
                    }
                }
            });
            observer.observe(rowRef.current);
            return () => observer.disconnect();
        }
    }, [index, setRowHeight, doc?.docId]);

    // Transform text: use shared normalization to match indexing
    const content = useMemo(() => {
        if (!doc?.text) return "";
        return normalizeContent(doc.text);
    }, [doc]);
    // filteredParagraphs contains 1-based indices of paragraphs to display
    const filteredParagraphs = useMemo(() => doc?.matches?.map(m => m.index + 1) || [], [doc]);

    if (!doc) return null;

    const isLast = index === results.length - 1;

    return (
        <div style={style}>
            <div ref={rowRef} className={!isLast ? styles.articleSeparator : ''}>
                <Article
                    selectedTag={doc.tag}
                    content={content}
                    filteredParagraphs={filteredParagraphs}
                    onTitleClick={() => gotoArticle(doc.tag)}
                    embedded={true}
                    hidePlayer={true}
                    highlight={highlight}
                />
            </div>
        </div>
    );
};

