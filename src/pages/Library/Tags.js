import React, { useMemo, useCallback } from "react";
import Box from "@mui/material/Box";
import List from "@mui/material/List";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import IconButton from "@mui/material/IconButton";
import Drawer from "@mui/material/Drawer";
import Paper from "@mui/material/Paper";
import FilterAltIcon from "@mui/icons-material/FilterAlt";
import ClearIcon from "@mui/icons-material/Clear";
import TreeItem from "./TreeItem";
import { LibraryIcons, LibraryTagKeys } from "./Icons";
import styles from "./Tags.module.scss";

export default function Tags({
    tags,
    filterText,
    setFilterText,
    debouncedFilterText,
    onSelect,
    selectedTag,
    translations,
    isMobile,
    showLibrarySideBar,
    closeDrawer,
    getTagHierarchy,
    customOrder
}) {
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

                    // If both items are "numbered" (number at the start), prioritize number sort
                    if (candA.position <= 2 && candB.position <= 2) {
                        return numA - numB;
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

    const selectedPath = useMemo(() => {
        return selectedTag ? getTagHierarchy(selectedTag).join("|") : null;
    }, [selectedTag, getTagHierarchy]);

    const handleTreeSelect = useCallback((tag) => {
        if (!isMobile) {
            onSelect(tag);
        } else {
            onSelect(tag);
            closeDrawer();
        }
    }, [isMobile, onSelect, closeDrawer]);

    const sideBarContent = (
        <Box className={styles.sidebarInner}>
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
                                <FilterAltIcon color="action" />
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
            <Box className={styles.treeContainer}>
                <List component="nav" sx={{ py: 1 }}>
                    {tree.map(node => (
                        <TreeItem
                            key={node.id}
                            node={node}
                            onSelect={handleTreeSelect}
                            selectedId={selectedTag?._id}
                            selectedPath={selectedPath}
                        />
                    ))}
                </List>
            </Box>

            {/* Auto-fill Tags button removed as per Phase 13 */}
        </Box>
    );


    if (isMobile) {
        return (
            <Drawer
                anchor="left"
                open={showLibrarySideBar}
                onClose={closeDrawer}
                ModalProps={{ keepMounted: true }}
                PaperProps={{ sx: { width: "85vw", maxWidth: "350px", height: "100%" } }}
            >
                {sideBarContent}
            </Drawer>
        );
    }

    return (
        <Paper
            elevation={3}
            className={styles.sidebar}
            sx={{
                width: showLibrarySideBar ? 450 : 0,
                opacity: showLibrarySideBar ? 1 : 0,
                ml: showLibrarySideBar ? 0 : -2,
                display: { xs: "none", sm: "flex" }
            }}
        >
            {sideBarContent}
        </Paper>
    );
}
