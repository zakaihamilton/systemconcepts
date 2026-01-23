import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import LinearProgress from "@mui/material/LinearProgress";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardActions from "@mui/material/CardActions";
import InputAdornment from "@mui/material/InputAdornment";
import SearchIcon from "@mui/icons-material/Search";
import RefreshIcon from "@mui/icons-material/Refresh";
import Autocomplete from "@mui/material/Autocomplete";
import Chip from "@mui/material/Chip";
import { makePath } from "@util/path";
import storage from "@util/storage";
import { SyncActiveStore } from "@sync/syncState";
import { LIBRARY_LOCAL_PATH } from "@sync/constants";
import { useTranslations } from "@util/translations";
import { setPath } from "@util/pages";
import styles from "./Research.module.scss";
import { LibraryTagKeys } from "./Icons";
import { useToolbar } from "@components/Toolbar";
import ReactMarkdown from "react-markdown";
import { LibraryStore } from "./Store";

const INDEX_FILE = "search_index.json";

function getTagHierarchy(tag) {
    const hierarchy = LibraryTagKeys.map(key => tag[key]).map(v => v ? String(v).trim() : null).filter(Boolean);
    if (tag.number && hierarchy.length > 0) {
        hierarchy[hierarchy.length - 1] = `${hierarchy[hierarchy.length - 1]}:${tag.number}`;
    }
    return hierarchy;
}

export default function Research() {
    const translations = useTranslations();
    const [query, setQuery] = useState("");
    const [results, setResults] = useState([]);
    const [indexing, setIndexing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [status, setStatus] = useState("");
    const [indexData, setIndexData] = useState(null);
    const [filterTags, setFilterTags] = useState([]);
    const [availableFilters, setAvailableFilters] = useState([]);
    const libraryUpdateCounter = SyncActiveStore.useState(s => s.libraryUpdateCounter);
    const isMounted = useRef(true);

    useEffect(() => {
        isMounted.current = true;
        return () => { isMounted.current = false; };
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
        setStatus(translations.LOADING_TAGS || "Loading tags...");

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
                             // Store metadata
                             newIndex.files[tag._id] = {
                                 title: tag.title || tag.chapter || "Untitled",
                                 tag: tag,
                                 paragraphs: []
                             };

                             // Split into paragraphs (approximate by double newline)
                             const paragraphs = text.split(/\n\s*\n/);

                             paragraphs.forEach((para, paraIndex) => {
                                 if (!para.trim()) return;

                                 const paraTokens = para.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
                                 const uniqueTokens = [...new Set(paraTokens)];

                                 if (uniqueTokens.length === 0) return;

                                 // Add to file data
                                 newIndex.files[tag._id].paragraphs.push(para);

                                 // Add to token index
                                 uniqueTokens.forEach(token => {
                                     if (!newIndex.tokens[token]) {
                                         newIndex.tokens[token] = []; // Stores "docId:paraIndex"
                                     }
                                     // Store reference as "docId:paraIndex"
                                     newIndex.tokens[token].push(`${tag._id}:${paraIndex}`);
                                 });
                             });
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
                setStatus(translations.DONE || "Done");
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

    const handleSearch = useCallback(() => {
        if (!indexData || !query.trim()) {
            setResults([]);
            return;
        }

        const terms = query.trim().split(/\s+/);
        const groups = query.split(/\s+OR\s+/).map(g => g.trim()).filter(Boolean);
        let finalRefs = new Set(); // Stores "docId:paraIndex"

        groups.forEach(group => {
            const groupTerms = group.split(/\s+/).filter(t => t !== "AND" && t !== "OR").map(t => t.toLowerCase());
            if (groupTerms.length === 0) return;

            let groupRefs = null;

            groupTerms.forEach(term => {
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
            });

            if (groupRefs) {
                groupRefs.forEach(ref => finalRefs.add(ref));
            }
        });

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

        setResults(Object.values(groupedResults));

    }, [indexData, query]);

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
                // We need to coordinate with the Article component to scroll
                // Using LibraryStore to pass this intent might be cleaner if direct URL hash isn't sufficient
                // Hash pattern: #library/Book/Chapter:paragraphId ?
                // Current system seems to use URL for hierarchy.
                // Article.js uses `scrollToParagraph` in store.
                LibraryStore.update(s => {
                    s.scrollToParagraph = paragraphId;
                });
            }
        }
    };

    const filteredResults = useMemo(() => {
        if (!filterTags.length) return results;
        return results.filter(doc => {
            return filterTags.every(filter => {
                return LibraryTagKeys.some(key => doc.tag[key] === filter);
            });
        });
    }, [results, filterTags]);

    const toolbarItems = [
        {
            id: "rebuildIndex",
            name: translations.REBUILD_INDEX || "Rebuild Index",
            icon: <RefreshIcon />,
            onClick: buildIndex,
            disabled: indexing,
            location: "header"
        }
    ];

    useToolbar({ id: "Research", items: toolbarItems, depends: [indexing, translations, buildIndex] });

    return (
        <Box className={styles.root}>
            <Box className={styles.searchHeader}>
                <TextField
                    fullWidth
                    placeholder={translations.SEARCH_ARTICLES || "Search articles (e.g. 'faith AND works', 'truth OR love')..."}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={onKeyDown}
                    InputProps={{
                        startAdornment: (
                            <InputAdornment position="start">
                                <SearchIcon />
                            </InputAdornment>
                        )
                    }}
                />
                <Button variant="contained" onClick={handleSearch} disabled={indexing || !indexData}>
                    {translations.SEARCH || "Search"}
                </Button>
            </Box>

            <Box sx={{ mb: 2 }}>
                <Autocomplete
                    multiple
                    options={availableFilters}
                    freeSolo
                    value={filterTags}
                    onChange={(event, newValue) => {
                        setFilterTags(newValue);
                    }}
                    renderTags={(value, getTagProps) =>
                        value.map((option, index) => (
                            <Chip variant="outlined" label={option} {...getTagProps({ index })} />
                        ))
                    }
                    renderInput={(params) => (
                        <TextField
                            {...params}
                            variant="outlined"
                            label={translations.FILTER_BY_TAGS || "Limit by tags (Book, Author...)"}
                            placeholder="Add tag..."
                            size="small"
                        />
                    )}
                />
            </Box>

            {indexing && (
                <Box className={styles.progressContainer}>
                    <Typography variant="caption">{status}</Typography>
                    <LinearProgress variant="determinate" value={progress} />
                </Box>
            )}

            <Box className={styles.results}>
                {results.length === 0 && query && !indexing && (
                    <Typography variant="body1" sx={{ p: 2 }}>
                        {translations.NO_RESULTS || "No results found."}
                    </Typography>
                )}
                {filteredResults.map((doc) => (
                    <Card key={doc.docId} sx={{ mb: 2 }} variant="outlined">
                        <CardContent>
                            <Typography variant="h6" component="div" gutterBottom>
                                {doc.title}
                            </Typography>
                            <Typography color="text.secondary" gutterBottom sx={{ fontSize: '0.875rem' }}>
                                {getTagHierarchy(doc.tag).join(" > ")}
                            </Typography>

                            {doc.matches.map((match, idx) => (
                                <Box key={idx} sx={{ mt: 1, p: 1, bgcolor: 'action.hover', borderRadius: 1 }}>
                                    <ReactMarkdown
                                        components={{
                                            p: ({node, ...props}) => <Typography variant="body2" {...props} />
                                        }}
                                    >
                                        {match.text}
                                    </ReactMarkdown>
                                    <Button
                                        size="small"
                                        onClick={() => gotoArticle(doc.tag, match.index)}
                                        sx={{ mt: 0.5, textTransform: 'none' }}
                                    >
                                        Jump to paragraph
                                    </Button>
                                </Box>
                            ))}
                        </CardContent>
                    </Card>
                ))}
            </Box>
        </Box>
    );
}
