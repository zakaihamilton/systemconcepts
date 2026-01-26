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
import { setPath, usePathItems } from "@util/pages";
import { normalizeContent } from "@util/string";
import styles from "./Research.module.scss";
import { LibraryTagKeys } from "@pages/Library/Icons";
import { useToolbar, registerToolbar } from "@components/Toolbar";
import { LibraryStore } from "@pages/Library/Store";
import { ResearchStore } from "@pages/ResearchStore";
import Article from "@pages/Library/Article";
import { ContentSize } from "@components/Page/Content";
import { VariableSizeList } from "react-window";
import { useDeviceType } from "@util/styles";
import ScrollToTop from "@pages/Library/Article/ScrollToTop";
import JumpDialog from "@pages/Library/Article/JumpDialog";
import PageIndicator from "./PageIndicator";
import SearchResultItem from "./SearchResultItem";

const INDEX_FILE = "search_index.json";

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
    const [lastSearch, setLastSearch] = useState({ query: "", filterTags: [] });
    const [appliedFilterTags, setAppliedFilterTags] = useState([]);
    const [searchCollapsed, setSearchCollapsed] = useState(false);
    const [jumpOpen, setJumpOpen] = useState(false);
    const [printing, setPrinting] = useState(false);
    const [showScrollTop, setShowScrollTop] = useState(false);
    const [printRoot, setPrintRoot] = useState(null);
    const isJumping = useRef(false);
    const jumpTimeout = useRef(null);
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
        ResearchStore.update(s => { s.indexing = true; });
    }, []);

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
    }, [loadTags, loadIndex, indexTimestamp]);

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
            let finalRefs = new Set(); // Stores "docId:paraIndex" or "fileIndex:paraIndex"

            const totalSteps = groups.reduce((acc, g) => acc + g.split(/\s+/).filter(t => t !== "AND" && t !== "OR").length, 0) + 1;
            let currentStep = 0;

            const isV2 = indexData.v === 2;
            const isV3 = indexData.v === 3;

            for (const group of groups) {
                const groupTerms = group.split(/\s+/).filter(t => t !== "AND" && t !== "OR").map(t => t.toLowerCase());
                if (groupTerms.length === 0) continue;
                searchTerms.push(...groupTerms);

                let groupRefs = null;

                for (const term of groupTerms) {
                    if (!isMounted.current) return;

                    const matchingTokens = Object.keys(indexData.t || indexData.tokens || {}).filter(k => k.includes(term));
                    let termRefs = new Set();
                    matchingTokens.forEach(k => {
                        const refs = isV3 ? indexData.t[k] : (isV2 ? indexData.t[k] : indexData.tokens[k]);
                        if (isV3) {
                            for (let i = 0; i < refs.length; i += 2) {
                                termRefs.add(`${refs[i]}:${refs[i + 1]}`);
                            }
                        } else {
                            refs.forEach(ref => termRefs.add(ref));
                        }
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
                        let paragraph = null;
                        if (isV3 || isV2) {
                            const fileIndex = parseInt(docId, 10);
                            paragraph = indexData.d[fileIndex]?.[parseInt(paraIndex, 10)];
                        } else {
                            const doc = indexData.files[docId];
                            paragraph = doc?.paragraphs?.[parseInt(paraIndex, 10)];
                        }

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
                                verifiedRefs.add(ref);
                            }
                        }
                    });

                    verifiedRefs.forEach(ref => finalRefs.add(ref));
                }
            }

            // Group by doc
            const groupedResults = {};
            const libraryTags = LibraryStore.getRawState().tags;

            [...finalRefs].forEach(ref => {
                const [docId, paraIndex] = ref.split(':');
                if (!groupedResults[docId]) {
                    let doc = null;
                    if (isV3 || isV2) {
                        const fileIndex = parseInt(docId, 10);
                        const tagId = indexData.f[fileIndex];
                        const tag = libraryTags.find(t => t._id === tagId);
                        if (tag) {
                            doc = {
                                docId: tagId,
                                tag,
                                paragraphs: indexData.d[fileIndex],
                                matches: []
                            };
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
                    const idx = parseInt(paraIndex, 10);
                    groupedResults[docId].matches.push({
                        index: idx,
                        text: groupedResults[docId].paragraphs[idx]
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
                                content={doc.content || normalizeContent(doc.text)} // handle potential missing content prop
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


