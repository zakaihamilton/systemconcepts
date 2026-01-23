import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import LinearProgress from "@mui/material/LinearProgress";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
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

    useEffect(() => {
        loadTags();
    }, [loadTags]);

    const loadIndex = useCallback(async () => {
        try {
            const indexPath = makePath(LIBRARY_LOCAL_PATH, INDEX_FILE);
            if (await storage.exists(indexPath)) {
                const content = await storage.readFile(indexPath);
                const data = JSON.parse(content);
                if (isMounted.current) {
                    setIndexData(data);
                }
            }
        } catch (err) {
            console.error("Failed to load search index:", err);
        }
    }, []);

    useEffect(() => {
        loadIndex();
    }, [loadIndex]);

    useEffect(() => {
        if (libraryUpdateCounter > 0) {
            loadIndex();
            loadTags();
        }
    }, [libraryUpdateCounter, loadIndex, loadTags]);

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
                             const tokens = text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
                             const uniqueTokens = [...new Set(tokens)];

                             const docId = tag._id;
                             newIndex.files[docId] = {
                                 title: tag.title || tag.chapter || "Untitled",
                                 tag: tag,
                                 snippetSource: text.substring(0, 200)
                             };

                             uniqueTokens.forEach(token => {
                                 if (!newIndex.tokens[token]) {
                                     newIndex.tokens[token] = [];
                                 }
                                 newIndex.tokens[token].push(docId);
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

    const handleSearch = useCallback(() => {
        if (!indexData || !query.trim()) {
            setResults([]);
            return;
        }

        const terms = query.trim().split(/\s+/);
        const groups = query.split(/\s+OR\s+/).map(g => g.trim()).filter(Boolean);
        let finalIds = new Set();

        groups.forEach(group => {
            const groupTerms = group.split(/\s+/).filter(t => t !== "AND" && t !== "OR").map(t => t.toLowerCase());
            if (groupTerms.length === 0) return;

            let groupIds = null;

            groupTerms.forEach(term => {
                const matchingTokens = Object.keys(indexData.tokens).filter(k => k.includes(term));
                let termIds = new Set();
                matchingTokens.forEach(k => {
                    indexData.tokens[k].forEach(id => termIds.add(id));
                });

                if (groupIds === null) {
                    groupIds = termIds;
                } else {
                    groupIds = new Set([...groupIds].filter(x => termIds.has(x)));
                }
            });

            if (groupIds) {
                groupIds.forEach(id => finalIds.add(id));
            }
        });

        const resultDocs = [...finalIds].map(id => indexData.files[id]).filter(Boolean);
        setResults(resultDocs);

    }, [indexData, query]);

    const onKeyDown = (e) => {
        if (e.key === 'Enter') {
            handleSearch();
        }
    };

    const gotoArticle = (tag) => {
        const hierarchy = getTagHierarchy(tag);
        if (hierarchy.length > 0) {
            setPath("library", ...hierarchy);
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

            <Box className={styles.controls}>
                <Button
                    startIcon={<RefreshIcon />}
                    onClick={buildIndex}
                    disabled={indexing}
                    variant="outlined"
                    size="small"
                >
                    {indexData ? (translations.REBUILD_INDEX || "Rebuild Index") : (translations.BUILD_INDEX || "Build Index")}
                </Button>
                {status && <Typography variant="caption">{status}</Typography>}
                {indexData && <Typography variant="caption">
                    {Object.keys(indexData.files).length} {translations.ARTICLES || "articles indexed"}
                </Typography>}
            </Box>

            {indexing && (
                <Box className={styles.progressContainer}>
                    <LinearProgress variant="determinate" value={progress} />
                </Box>
            )}

            <Box className={styles.results}>
                <List>
                    {filteredResults.length === 0 && query && !indexing && (
                        <ListItem>
                            <ListItemText primary={translations.NO_RESULTS || "No results found."} />
                        </ListItem>
                    )}
                    {filteredResults.map((doc, index) => (
                        <ListItemButton key={index} className={styles.resultItem} onClick={() => gotoArticle(doc.tag)}>
                            <ListItemText
                                primary={doc.title}
                                secondary={
                                    <span className={styles.snippet}>
                                        {getTagHierarchy(doc.tag).join(" > ")}
                                    </span>
                                }
                            />
                        </ListItemButton>
                    ))}
                </List>
            </Box>
        </Box>
    );
}
