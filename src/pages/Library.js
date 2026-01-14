import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useSearch } from "@components/Search";
import storage from "@util/storage";
import { LIBRARY_LOCAL_PATH } from "@sync/constants";
import { makePath } from "@util/path";
import Box from "@mui/material/Box";
import { useTranslations } from "@util/translations";
import { setPath, usePathItems, replacePath } from "@util/pages";
import { MainStore } from "@components/Main";
import { SyncActiveStore } from "@sync/syncState";
import { LibraryStore } from "./Library/Store";
import { LibraryTagKeys } from "./Library/Icons";
import { useDeviceType } from "@util/styles";
import Cookies from "js-cookie";
import { roleAuth } from "@util/roles";
import EditTagsDialog from "./Library/EditTagsDialog";
import Tags from "./Library/Tags";
import Article from "./Library/Article";
import styles from "./Library.module.scss";
import { registerToolbar, useToolbar } from "@components/Toolbar";
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { useSwipe } from "@util/touch";

registerToolbar("Library");

export default function Library() {
    const { showLibrarySideBar } = MainStore.useState();
    const isMobile = useDeviceType() !== "desktop";
    const search = useSearch();
    const [filterText, setFilterText] = useState("");
    const [debouncedFilterText, setDebouncedFilterText] = useState("");
    const [tags, setTags] = useState([]);
    const [content, setContent] = useState(null);
    const [selectedTag, setSelectedTag] = useState(null);
    const translations = useTranslations();
    const pathItems = usePathItems();
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [isHeaderShrunk, setIsHeaderShrunk] = useState(false);

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedFilterText(filterText);
        }, 1000);
        return () => clearTimeout(handler);
    }, [filterText]);

    const contentRef = React.useRef(null);
    const handleScroll = useCallback((e) => {
        const scrollTop = e.target.scrollTop;
        const shouldShrink = scrollTop > 100;
        if (shouldShrink !== isHeaderShrunk) {
            setIsHeaderShrunk(shouldShrink);
        }
    }, [isHeaderShrunk]);

    const role = Cookies.get("role");
    const isAdmin = roleAuth(role, "admin");

    const getTagHierarchy = useCallback((tag) => {
        const hierarchy = LibraryTagKeys.map(key => tag[key]).map(v => v ? String(v).trim() : null).filter(Boolean);
        if (tag.number && hierarchy.length > 0) {
            hierarchy[hierarchy.length - 1] = `${hierarchy[hierarchy.length - 1]}#${tag.number}`;
        }
        return hierarchy;
    }, []);

    const onSelect = useCallback((tag) => {
        setSelectedTag(tag);
        const hierarchy = getTagHierarchy(tag);
        if (hierarchy.length > 0) {
            setPath("library", ...hierarchy);
        }
        // Remember the last viewed article
        LibraryStore.update(s => {
            s.lastViewedArticle = tag;
        });
    }, [getTagHierarchy]);

    useEffect(() => {
        if (tags.length > 0 && pathItems.length > 1 && pathItems[0] === "library") {
            const urlPath = pathItems.slice(1).join("|");
            const tag = tags.find(t => getTagHierarchy(t).join("|") === urlPath);
            if (tag) {
                setSelectedTag(tag);
                // Remember the last viewed article
                LibraryStore.update(s => {
                    s.lastViewedArticle = tag;
                });
            }
        } else if (tags.length > 0 && pathItems.length === 1 && pathItems[0] === "library") {
            // If we're on the root library page, restore the last viewed article
            const { lastViewedArticle } = LibraryStore.getRawState();
            if (lastViewedArticle) {
                const tag = tags.find(t => t._id === lastViewedArticle._id);
                if (tag) {
                    onSelect(tag);
                }
            }
        }
    }, [tags, pathItems, getTagHierarchy, onSelect]);

    const [customOrder, setCustomOrder] = useState({});
    const libraryUpdateCounter = SyncActiveStore.useState(s => s.libraryUpdateCounter);
    const contentCacheRef = useRef(new Map());
    const fileCacheRef = useRef(new Map());

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
        loadTags();
        loadCustomOrder();
    }, [loadTags, loadCustomOrder]);

    const loadContent = useCallback(async () => {
        if (!selectedTag) {
            setContent(null);
            return;
        }

        // Check content cache first
        const cacheKey = selectedTag._id;
        if (contentCacheRef.current.has(cacheKey)) {
            setContent(contentCacheRef.current.get(cacheKey));
            return;
        }

        try {
            const filePath = makePath(LIBRARY_LOCAL_PATH, selectedTag.path);
            let data;

            // Check file cache
            if (fileCacheRef.current.has(filePath)) {
                data = fileCacheRef.current.get(filePath);
            } else if (await storage.exists(filePath)) {
                const fileContent = await storage.readFile(filePath);
                data = JSON.parse(fileContent);
                fileCacheRef.current.set(filePath, data);
            } else {
                setContent("File not found.");
                return;
            }

            let item = null;
            if (Array.isArray(data)) {
                item = data.find(i => i._id === selectedTag._id);
            } else if (data._id === selectedTag._id) {
                item = data;
            }

            const contentText = item ? item.text : "Content not found in file.";
            contentCacheRef.current.set(cacheKey, contentText);
            setContent(contentText);
        } catch (err) {
            console.error("Failed to load content:", err);
            setContent("Error loading content.");
        }
    }, [selectedTag]);

    useEffect(() => {
        if (!selectedTag && !isMobile) {
            MainStore.update(s => {
                s.showLibrarySideBar = true;
            });
        }
    }, [selectedTag, isMobile]);

    useEffect(() => {
        loadContent();
    }, [loadContent]);

    useEffect(() => {
        if (libraryUpdateCounter > 0) {
            // Clear caches when library is updated
            contentCacheRef.current.clear();
            fileCacheRef.current.clear();
            loadTags();
            loadCustomOrder();
            loadContent();
        }
    }, [libraryUpdateCounter, loadTags, loadCustomOrder, loadContent]);

    const closeDrawer = () => {
        MainStore.update(s => { s.showLibrarySideBar = false; });
    };

    const handleDrawerToggle = () => {
        MainStore.update(s => { s.showLibrarySideBar = !s.showLibrarySideBar; });
    };

    // Navigation between articles - flatten the tree in display order
    const sortedTags = useMemo(() => {
        if (!tags || tags.length === 0) return [];

        // We need to build the same tree structure as Tags.js and flatten it
        // Import the same sorting logic
        const root = { id: "root", name: "Library", children: [] };

        for (const tag of tags) {
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
                    node = {
                        id,
                        name,
                        type,
                        children: [],
                        ...(!isHead ? { ...tag, _id: tag._id, number: tag.number } : {})
                    };
                    currentLevel.push(node);
                }
                currentLevel = node.children;
            });
        }

        // Use the same sorting logic as Tags.js
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

        // Flatten the tree in depth-first order
        const flattened = [];
        const flatten = (nodes) => {
            nodes.forEach(node => {
                if (node._id) {
                    flattened.push(node);
                }
                if (node.children && node.children.length > 0) {
                    flatten(node.children);
                }
            });
        };
        flatten(root.children);

        return flattened;
    }, [tags, customOrder]);

    const currentIndex = useMemo(() => {
        if (!selectedTag || sortedTags.length === 0) return -1;
        return sortedTags.findIndex(tag => tag._id === selectedTag._id);
    }, [selectedTag, sortedTags]);

    const prevArticle = currentIndex > 0 && sortedTags[currentIndex - 1];
    const nextArticle = currentIndex !== -1 && currentIndex < sortedTags.length - 1 && sortedTags[currentIndex + 1];

    const gotoArticle = useCallback((tag) => {
        if (!tag) return;
        onSelect(tag);
    }, [onSelect]);

    const toolbarItems = [
        !isMobile && {
            id: "prevArticle",
            name: translations.PREVIOUS,
            icon: <ArrowBackIcon />,
            onClick: () => prevArticle && gotoArticle(prevArticle),
            location: "header",
            disabled: !prevArticle
        },
        !isMobile && {
            id: "nextArticle",
            name: translations.NEXT,
            icon: <ArrowForwardIcon />,
            onClick: () => nextArticle && gotoArticle(nextArticle),
            location: "header",
            disabled: !nextArticle
        }
    ];

    useToolbar({ id: "Library", items: toolbarItems, depends: [prevArticle, nextArticle, translations, isMobile] });

    const swipeHandlers = useSwipe({
        onSwipeLeft: () => nextArticle && gotoArticle(nextArticle),
        onSwipeRight: () => prevArticle && gotoArticle(prevArticle)
    });

    return (
        <Box className={styles.root} {...swipeHandlers}>
            <Tags
                tags={tags}
                filterText={filterText}
                setFilterText={setFilterText}
                debouncedFilterText={debouncedFilterText}
                onSelect={onSelect}
                selectedTag={selectedTag}
                translations={translations}
                isAdmin={isAdmin}
                isMobile={isMobile}
                showLibrarySideBar={showLibrarySideBar}
                closeDrawer={closeDrawer}
                getTagHierarchy={getTagHierarchy}
                customOrder={customOrder}
            />

            <Article
                selectedTag={selectedTag}
                content={content}
                search={search}
                translations={translations}
                isAdmin={isAdmin}
                openEditDialog={() => setEditDialogOpen(true)}
                isHeaderShrunk={isHeaderShrunk}
                handleScroll={handleScroll}
                contentRef={contentRef}
                handleDrawerToggle={handleDrawerToggle}
                showLibrarySideBar={showLibrarySideBar}
            />

            {isAdmin && selectedTag && (
                <EditTagsDialog
                    open={editDialogOpen}
                    onClose={() => setEditDialogOpen(false)}
                    selectedTag={selectedTag}
                    tags={tags}
                    setTags={setTags}
                    setSelectedTag={setSelectedTag}
                    setContent={setContent}
                />
            )}
        </Box>
    );
}
