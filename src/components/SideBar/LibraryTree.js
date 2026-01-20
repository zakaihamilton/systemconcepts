import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Box from "@mui/material/Box";
import List from "@mui/material/List";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import IconButton from "@mui/material/IconButton";
import FilterAltIcon from "@mui/icons-material/FilterAlt";
import ClearIcon from "@mui/icons-material/Clear";
import TreeItem from "@pages/Library/TreeItem";
import { LibraryIcons, LibraryTagKeys } from "@pages/Library/Icons";
import { LibraryStore } from "@pages/Library/Store";
import { LIBRARY_LOCAL_PATH } from "@sync/constants";
import { makePath } from "@util/path";
import storage from "@util/storage";
import { setPath, usePathItems } from "@util/pages";
import { SyncActiveStore } from "@sync/syncState";
import { useTranslations } from "@util/translations";
import styles from "./LibraryTree.module.scss";

export default function LibraryTree({ closeDrawer, isMobile }) {
    const translations = useTranslations();
    const [filterText, setFilterText] = useState("");
    const [debouncedFilterText, setDebouncedFilterText] = useState("");
    const [tags, setTags] = useState([]);
    const [customOrder, setCustomOrder] = useState({});
    const pathItems = usePathItems();
    const libraryUpdateCounter = SyncActiveStore.useState(s => s.libraryUpdateCounter);
    const scrollToPath = LibraryStore.useState(s => s.scrollToPath);
    const treeContainerRef = useRef(null);

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedFilterText(filterText);
        }, 500);
        return () => clearTimeout(handler);
    }, [filterText]);

    // Handle scroll-to-path from breadcrumb clicks
    useEffect(() => {
        if (scrollToPath) {
            LibraryStore.update(s => {
                s.selectPath = scrollToPath;
            });
            // Clear the scrollToPath after a delay
            setTimeout(() => {
                LibraryStore.update(s => {
                    s.scrollToPath = null;
                });
                // Clear highlight after scroll animation completes
                setTimeout(() => {
                    LibraryStore.update(s => {
                        s.selectPath = null;
                    });
                }, 1000);
            }, 100);
        }
    }, [scrollToPath]);

    const loadTags = useCallback(async () => {
        try {
            const tagsPath = makePath(LIBRARY_LOCAL_PATH, "tags.json");
            if (await storage.exists(tagsPath)) {
                const fileContents = await storage.readFile(tagsPath);
                const data = JSON.parse(fileContents);
                setTags(data);
                LibraryStore.update(s => {
                    s.tags = data;
                });
            }
        } catch (err) {
            console.error("Failed to load library tags:", err);
        }
    }, []);

    const loadCustomOrder = useCallback(async () => {
        try {
            const orderPath = makePath(LIBRARY_LOCAL_PATH, "library-order.json");
            if (await storage.exists(orderPath)) {
                const fileContents = await storage.readFile(orderPath);
                const data = JSON.parse(fileContents);
                setCustomOrder(data);
            }
        } catch (err) {
            console.error("Failed to load library order:", err);
        }
    }, []);

    useEffect(() => {
        setTimeout(() => {
            loadTags();
            loadCustomOrder();
        }, 0);
    }, [loadTags, loadCustomOrder]);

    useEffect(() => {
        if (libraryUpdateCounter > 0) {
            setTimeout(() => {
                loadTags();
                loadCustomOrder();
            }, 0);
        }
    }, [libraryUpdateCounter, loadTags, loadCustomOrder]);

    const getTagHierarchy = useCallback((tag) => {
        const hierarchy = LibraryTagKeys.map(key => tag[key]).map(v => v ? String(v).trim() : null).filter(Boolean);
        if (tag.number && hierarchy.length > 0) {
            hierarchy[hierarchy.length - 1] = `${hierarchy[hierarchy.length - 1]}#${tag.number}`;
        }
        return hierarchy;
    }, []);

    // Sync selectedTag with URL
    useEffect(() => {
        if (tags.length > 0 && pathItems.length > 1 && pathItems[0] === "library") {
            const urlPath = pathItems.slice(1).join("|");
            const tag = tags.find(t => getTagHierarchy(t).join("|") === urlPath);
            if (tag) {
                // Calculate parent IDs for expansion
                const hierarchy = getTagHierarchy(tag);
                const parentIds = [];
                let currentPath = "";
                hierarchy.forEach((segment, index) => {
                    if (index < hierarchy.length - 1) { // Don't expand leaf
                        currentPath = currentPath ? currentPath + "|" + segment : segment;
                        const matchingNode = tags.find(t => getTagHierarchy(t).join("|") === currentPath);
                        // This logic is simplified; strictly mapping path segments to IDs might require tree traversal
                        // For now, let's just trigger the selectPath update which TreeItem will react to
                    }
                });

                LibraryStore.update(s => {
                    s.selectedId = tag._id;
                    s.selectPath = urlPath;
                });
            } else {
                LibraryStore.update(s => {
                    s.selectedId = null;
                    s.selectPath = null;
                });
            }
        }
    }, [tags, pathItems, getTagHierarchy]);


    const tree = useMemo(() => {
        const root = { id: "root", name: "Library", children: [] };

        let filteredTags = tags;
        if (debouncedFilterText) {
            const lowerFilter = debouncedFilterText.toLowerCase();
            const keysToSearch = [...LibraryTagKeys, "number"];
            const terms = lowerFilter.split(/\s+/).filter(Boolean);

            filteredTags = tags.filter(tag => {
                const values = keysToSearch.map(key => tag[key]).filter(v => v && String(v).trim()).map(v => String(v).toLowerCase());
                const allValues = values.join(" ");

                if (terms.includes("or")) {
                    const groups = lowerFilter.split(/\s+or\s+/).filter(Boolean);
                    return groups.some(group => {
                        const groupTerms = group.split(/\s+/).filter(Boolean);
                        return groupTerms.every(term => allValues.includes(term));
                    });
                }

                return terms.every(term => allValues.includes(term));
            });
        }

        for (const tag of filteredTags) {
            let currentLevel = root.children;
            const levels = LibraryTagKeys.map(key => ({ key, value: tag[key] }))
                .filter(item => item.value && String(item.value).trim())
                .map(item => ({ key: item.key, value: String(item.value).trim() }));
            if (levels.length === 0) continue;

            const pathIds = [];
            levels.forEach((levelItem, index) => {
                const { key: type, value: name } = levelItem;
                const isHead = index < levels.length - 1;
                const nodeNumber = (!isHead && tag.number) ? tag.number : null;
                const idSuffix = nodeNumber ? `#${nodeNumber}` : '';

                pathIds.push(name + idSuffix);
                const id = pathIds.join("|");

                let node = currentLevel.find(n => n.id === id);
                if (!node) {
                    const Icon = LibraryIcons[type];
                    node = {
                        id,
                        name,
                        type,
                        Icon,
                        children: [],
                        ...(!isHead ? { ...tag, _id: tag._id, number: tag.number } : {})
                    };
                    currentLevel.push(node);
                }
                currentLevel = node.children;
            });
        }

        const numberWords = {
            'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
            'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
            'eleven': 11, 'twelve': 12, 'thirteen': 13, 'fourteen': 14, 'fifteen': 15,
            'sixteen': 16, 'seventeen': 17, 'eighteen': 18, 'nineteen': 19, 'twenty': 20,
            'first': 1, 'second': 2, 'third': 3, 'fourth': 4, 'fifth': 5,
            'sixth': 6, 'seventh': 7, 'eighth': 8, 'ninth': 9, 'tenth': 10
        };

        const getPriority = (name) => {
            if (!name) return 999;
            const lowerName = name.toLowerCase().replace(/['']/g, "'");
            if (lowerName.includes("editor") && lowerName.includes("note")) return 0;
            if (lowerName.startsWith("intro")) return 1;
            if (lowerName.startsWith("preface")) return 2;
            if (lowerName.startsWith("foreword")) return 3;
            if (lowerName.startsWith("prologue")) return 4;
            if (lowerName.startsWith("contents") || lowerName.includes("table of contents")) return 5;
            return 999;
        };

        const extractNumber = (name) => {
            if (!name) return null;
            const lowerName = name.toLowerCase();
            const candidates = [];
            const digitRegex = /(\d+)/g;
            let digitMatch;
            while ((digitMatch = digitRegex.exec(name)) !== null) {
                candidates.push({ position: digitMatch.index, value: parseInt(digitMatch[1], 10) });
            }
            const wordRegex = /[a-z]+/gi;
            let wordMatch;
            while ((wordMatch = wordRegex.exec(lowerName)) !== null) {
                const word = wordMatch[0];
                if (numberWords[word] !== undefined) {
                    candidates.push({ position: wordMatch.index, value: numberWords[word] });
                }
            }
            if (candidates.length === 0) return null;
            candidates.sort((a, b) => a.position - b.position);
            return candidates[0];
        };

        const getBaseName = (name) => {
            if (!name) return "";
            let base = name.toLowerCase();
            base = base.replace(/\d+/g, '');
            const words = Object.keys(numberWords).sort((a, b) => b.length - a.length);
            words.forEach(word => {
                const regex = new RegExp(`\\b${word}\\b`, 'g');
                base = base.replace(regex, '');
            });
            return base.replace(/\s+/g, ' ').trim();
        };

        const getCustomOrderVal = (name) => {
            if (!name || !customOrder) return null;
            if (customOrder[name] !== undefined) return customOrder[name];
            const lowerName = name.toLowerCase();
            for (const [key, value] of Object.entries(customOrder)) {
                if (key.toLowerCase() === lowerName) return value;
            }
            return null;
        };

        const sortTree = (nodes) => {
            nodes.sort((a, b) => {
                const nameA = a.name || "";
                const nameB = b.name || "";
                const priorityA = getPriority(nameA);
                const priorityB = getPriority(nameB);
                if (priorityA !== priorityB) return priorityA - priorityB;

                const customA = getCustomOrderVal(nameA);
                const customB = getCustomOrderVal(nameB);
                if (customA !== null && customB !== null) return customA - customB;
                if (customA !== null) return -1;
                if (customB !== null) return 1;

                const orderA = (a.order !== undefined && a.order !== null && a.order !== "") ? parseInt(a.order, 10) : null;
                const orderB = (b.order !== undefined && b.order !== null && b.order !== "") ? parseInt(b.order, 10) : null;
                if (orderA !== null && orderB !== null && !isNaN(orderA) && !isNaN(orderB)) {
                    if (orderA !== orderB) return orderA - orderB;
                }
                if (orderA !== null && !isNaN(orderA)) return -1;
                if (orderB !== null && !isNaN(orderB)) return 1;

                const tagNumA = (a.number !== undefined && a.number !== null && a.number !== "") ? parseInt(a.number, 10) : null;
                const tagNumB = (b.number !== undefined && b.number !== null && b.number !== "") ? parseInt(b.number, 10) : null;
                if (tagNumA !== null && tagNumB !== null && !isNaN(tagNumA) && !isNaN(tagNumB)) {
                    if (tagNumA !== tagNumB) return tagNumA - tagNumB;
                    const subNumA = (a.subNumber !== undefined && a.subNumber !== null && a.subNumber !== "") ? parseInt(a.subNumber, 10) : null;
                    const subNumB = (b.subNumber !== undefined && b.subNumber !== null && b.subNumber !== "") ? parseInt(b.subNumber, 10) : null;
                    if (subNumA !== null && subNumB !== null && !isNaN(subNumA) && !isNaN(subNumB)) {
                        if (subNumA !== subNumB) return subNumA - subNumB;
                    }
                    if (subNumA !== null && !isNaN(subNumA)) return -1;
                    if (subNumB !== null && !isNaN(subNumB)) return 1;
                }
                if (tagNumA !== null && !isNaN(tagNumA)) return -1;
                if (tagNumB !== null && !isNaN(tagNumB)) return 1;

                const candA = extractNumber(nameA);
                const candB = extractNumber(nameB);

                if (candA && candB) {
                    const numA = candA.value;
                    const numB = candB.value;
                    const baseA = getBaseName(nameA);
                    const baseB = getBaseName(nameB);
                    if (baseA === baseB) return numA - numB;

                    if (candA.position <= 2 && candB.position <= 2) {
                        if (numA !== numB) return numA - numB;
                        if (nameA.length !== nameB.length) return nameA.length - nameB.length;
                    }

                    const baseCompare = baseA.localeCompare(baseB, undefined, { numeric: true, sensitivity: 'base' });
                    if (baseCompare !== 0) return baseCompare;
                    return numA - numB;
                }
                if (candA) return -1;
                if (candB) return 1;

                return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: 'base' });
            });
            nodes.forEach(node => {
                if (node.children && node.children.length > 0) sortTree(node.children);
            });
        };

        sortTree(root.children);
        return root.children;
    }, [tags, debouncedFilterText, customOrder]);


    const onSelect = useCallback((tag) => {
        LibraryStore.update(s => {
            s.selectedId = tag._id;
        });
        const hierarchy = getTagHierarchy(tag);
        if (hierarchy.length > 0) {
            setPath("library", ...hierarchy);
        }
        LibraryStore.update(s => {
            s.lastViewedArticle = tag;
        });
        if (isMobile && closeDrawer) {
            closeDrawer();
        }
    }, [getTagHierarchy, isMobile, closeDrawer]);

    const handleToggle = useCallback((nodeId, isExpanding) => {
        if (isExpanding) {
            const siblingIds = tree.map(node => node.id).filter(id => id !== nodeId);
            LibraryStore.update(s => {
                s.expandedNodes = s.expandedNodes.filter(id => !siblingIds.includes(id));
                if (!s.expandedNodes.includes(nodeId)) {
                    s.expandedNodes = [...s.expandedNodes, nodeId];
                }
            });
        } else {
            LibraryStore.update(s => {
                s.expandedNodes = s.expandedNodes.filter(id => id !== nodeId);
            });
        }
    }, [tree]);

    if (!tags || tags.length === 0) {
        return null;
    }

    return (
        <Box className={styles.root}>
            <Box className={styles.searchContainer}>
                <TextField
                    placeholder={translations.FILTER_TAGS || "Filter tags..."}
                    value={filterText}
                    onChange={(e) => setFilterText(e.target.value)}
                    fullWidth
                    size="small"
                    className={styles.filterInput}
                    InputProps={{
                        startAdornment: (
                            <InputAdornment position="start">
                                <FilterAltIcon color="action" fontSize="small" />
                            </InputAdornment>
                        ),
                        endAdornment: filterText ? (
                            <InputAdornment position="end">
                                <IconButton
                                    size="small"
                                    onClick={() => setFilterText("")}
                                    edge="end"
                                    sx={{ mr: -0.5 }}
                                >
                                    <ClearIcon fontSize="small" />
                                </IconButton>
                            </InputAdornment>
                        ) : null
                    }}
                />
            </Box>
            <Box className={styles.treeContainer} ref={treeContainerRef}>
                <List component="nav" sx={{ py: 0.5, pl: 3 }}>
                    {tree.map(node => (
                        <TreeItem
                            key={node.id}
                            node={node}
                            onSelect={onSelect}
                            onToggle={handleToggle}
                            level={0}
                        />
                    ))}
                </List>
            </Box>
        </Box>
    );
}
