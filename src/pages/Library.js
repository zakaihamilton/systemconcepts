import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useSearch } from "@components/Search";
import storage from "@util/storage";
import { LIBRARY_LOCAL_PATH } from "@sync/constants";
import { makePath } from "@util/path";
import Box from "@mui/material/Box";
import List from "@mui/material/List";
import Typography from "@mui/material/Typography";
import Paper from "@mui/material/Paper";
import Divider from "@mui/material/Divider";
import Drawer from "@mui/material/Drawer";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import ReactMarkdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import { useTranslations } from "@util/translations";
import LibraryBooksIcon from "@mui/icons-material/LibraryBooks";
import FilterAltIcon from "@mui/icons-material/FilterAlt";
import TreeItem from "./Library/TreeItem";
import { setPath, usePathItems } from "@util/pages";
import { MainStore } from "@components/Main";
import { SyncActiveStore } from "@sync/syncState";
import { LibraryStore } from "./Library/Store";
import { LibraryIcons, LibraryTagKeys } from "./Library/Icons";
import { useDeviceType } from "@util/styles";
import IconButton from "@mui/material/IconButton";
import EditIcon from "@mui/icons-material/Edit";
import Tooltip from "@mui/material/Tooltip";
import Cookies from "js-cookie";
import { roleAuth } from "@util/roles";
import EditTagsDialog from "./Library/EditTagsDialog";
import styles from "./Library.module.scss";

export default function Library() {
    const search = useSearch();
    const [filterText, setFilterText] = useState("");
    const [tags, setTags] = useState([]);
    const [content, setContent] = useState(null);
    const [selectedTag, setSelectedTag] = useState(null);
    const translations = useTranslations();
    const pathItems = usePathItems();
    const [editDialogOpen, setEditDialogOpen] = useState(false);

    const role = Cookies.get("role");
    const isAdmin = roleAuth(role, "admin");

    const getTagHierarchy = useCallback((tag) => {
        return LibraryTagKeys.map(key => tag[key]).map(v => v ? String(v).trim() : null).filter(Boolean);
    }, []);

    const onSelect = useCallback((tag) => {
        setSelectedTag(tag);
        const hierarchy = LibraryTagKeys.map(key => tag[key]).map(v => v ? String(v).trim() : null).filter(Boolean);
        if (hierarchy.length > 0) {
            setPath("library", ...hierarchy);
        }
    }, []);

    useEffect(() => {
        if (tags.length > 0 && pathItems.length > 1 && pathItems[0] === "library") {
            const urlPath = pathItems.slice(1).join("|");
            const tag = tags.find(t => getTagHierarchy(t).join("|") === urlPath);
            if (tag) {
                setSelectedTag(tag);
            }
        }
    }, [tags, pathItems]);

    const [customOrder, setCustomOrder] = useState({});
    const libraryUpdateCounter = SyncActiveStore.useState(s => s.libraryUpdateCounter);

    const loadTags = useCallback(async () => {
        try {
            const tagsPath = makePath(LIBRARY_LOCAL_PATH, "tags.json");
            if (await storage.exists(tagsPath)) {
                const content = await storage.readFile(tagsPath);
                const data = JSON.parse(content);
                console.log("Loaded tags:", data.length);
                setTags(data);
                LibraryStore.update(s => {
                    s.tags = data;
                });
            } else {
                console.warn("Library tags not found at", tagsPath);
            }
        } catch (err) {
            console.error("Failed to load library tags:", err);
        }
    }, []);

    const loadCustomOrder = useCallback(async () => {
        try {
            const orderPath = makePath(LIBRARY_LOCAL_PATH, "library-order.json");
            if (await storage.exists(orderPath)) {
                const content = await storage.readFile(orderPath);
                const data = JSON.parse(content);
                console.log("Loaded custom order:", Object.keys(data).length, "items");
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
        try {
            const filePath = makePath(LIBRARY_LOCAL_PATH, selectedTag.path);
            if (await storage.exists(filePath)) {
                const fileContent = await storage.readFile(filePath);
                const data = JSON.parse(fileContent);
                let item = null;
                if (Array.isArray(data)) {
                    item = data.find(i => i._id === selectedTag._id);
                } else if (data._id === selectedTag._id) {
                    item = data;
                }

                if (item) {
                    setContent(item.text);
                } else {
                    setContent("Content not found in file.");
                }
            } else {
                setContent("File not found.");
            }
        } catch (err) {
            console.error("Failed to load content:", err);
            setContent("Error loading content.");
        }
    }, [selectedTag]);

    useEffect(() => {
        loadContent();
    }, [loadContent]);

    useEffect(() => {
        if (libraryUpdateCounter > 0) {
            console.log("Library update detected, reloading...");
            loadTags();
            loadCustomOrder();
            loadContent();
        }
    }, [libraryUpdateCounter, loadTags, loadCustomOrder, loadContent]);

    const { showLibrarySideBar } = MainStore.useState();
    const isMobile = useDeviceType() !== "desktop";

    const setShowSidebar = (show) => {
        MainStore.update(s => {
            s.showLibrarySideBar = show;
        });
    };

    const closeDrawer = () => {
        setShowSidebar(false);
    };

    const openEditDialog = () => {
        if (selectedTag) {
            setEditDialogOpen(true);
        }
    };

    const tree = useMemo(() => {
        const root = { id: "root", name: "Library", children: [] };

        let filteredTags = tags;
        if (filterText) {
            const lowerFilter = filterText.toLowerCase();
            const keysToSearch = [...LibraryTagKeys, "number"];

            // AND/OR Logic
            const terms = lowerFilter.split(/\s+/).filter(Boolean);

            filteredTags = tags.filter(tag => {
                const values = keysToSearch.map(key => tag[key]).filter(v => v && String(v).trim()).map(v => String(v).toLowerCase());
                const allValues = values.join(" "); // Concatenate all values for easier searching

                // Check for OR logic (e.g., "term1 OR term2")
                if (terms.includes("or")) {
                    const groups = lowerFilter.split(/\s+or\s+/).filter(Boolean);
                    return groups.some(group => {
                        const groupTerms = group.split(/\s+/).filter(Boolean);
                        return groupTerms.every(term => allValues.includes(term));
                    });
                }

                // Default AND logic
                return terms.every(term => allValues.includes(term));
            });
        }

        for (const tag of filteredTags) {
            let currentLevel = root.children;
            // Build levels with their corresponding keys to track the correct type
            const levels = LibraryTagKeys.map(key => ({ key, value: tag[key] }))
                .filter(item => item.value && String(item.value).trim())
                .map(item => ({ key: item.key, value: String(item.value).trim() }));
            if (levels.length === 0) continue;

            const pathIds = [];
            levels.forEach((levelItem, index) => {
                const { key: type, value: name } = levelItem;
                const isHead = index < levels.length - 1;
                pathIds.push(name);
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
                        number: (type === "article") ? tag.number : null,
                        ...(!isHead ? { ...tag, _id: tag._id } : {})
                    };
                    currentLevel.push(node);
                }
                currentLevel = node.children;
            });
        }

        // Recursively sort all levels of the tree
        const numberWords = {
            'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
            'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
            'eleven': 11, 'twelve': 12, 'thirteen': 13, 'fourteen': 14, 'fifteen': 15,
            'sixteen': 16, 'seventeen': 17, 'eighteen': 18, 'nineteen': 19, 'twenty': 20,
            'first': 1, 'second': 2, 'third': 3, 'fourth': 4, 'fifth': 5,
            'sixth': 6, 'seventh': 7, 'eighth': 8, 'ninth': 9, 'tenth': 10
        };

        const extractNumber = (name) => {
            if (!name) return null;
            const match = name.match(/^(\d+)/);
            if (match) {
                return parseInt(match[1], 10);
            }
            const lowerName = name.toLowerCase();
            const words = lowerName.split(/[^a-z]+/);
            for (const word of words) {
                if (numberWords[word] !== undefined) {
                    return numberWords[word];
                }
            }
            return null;
        };

        // Priority items that should appear first (lower number = higher priority)
        const getPriority = (name) => {
            if (!name) return 999;
            // Normalize: lowercase and replace curly/smart quotes with straight quotes
            const lowerName = name.toLowerCase().replace(/['']/g, "'");
            if (lowerName.includes("editor") && lowerName.includes("note")) return 0;
            if (lowerName.startsWith("introduction")) return 1;
            return 999;
        };

        // Get custom order from library-order.json (case-insensitive lookup)
        const getCustomOrder = (name) => {
            if (!name || !customOrder) return null;
            // Try exact match first, then lowercase
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

                // Check for priority items first
                const priorityA = getPriority(nameA);
                const priorityB = getPriority(nameB);
                if (priorityA !== priorityB) {
                    return priorityA - priorityB;
                }

                // Check for custom order from library-order.json
                const customA = getCustomOrder(nameA);
                const customB = getCustomOrder(nameB);
                if (customA !== null && customB !== null) {
                    return customA - customB;
                }
                // If only one has custom order, it comes first
                if (customA !== null) return -1;
                if (customB !== null) return 1;

                // Check for number word prefixes
                const numA = extractNumber(nameA);
                const numB = extractNumber(nameB);

                // If both have number word prefixes, sort by number
                if (numA !== null && numB !== null) {
                    if (numA !== numB) {
                        return numA - numB;
                    }
                }
                // If only one has a number word prefix, it comes first
                else {
                    if (numA !== null) return -1;
                    if (numB !== null) return 1;
                }

                // Natural sort (handles numbers correctly: 1,2,3,10 instead of 1,10,2,3)
                return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: 'base' });
            });
            nodes.forEach(node => {
                if (node.children && node.children.length > 0) {
                    sortTree(node.children);
                }
            });
        };

        sortTree(root.children);
        return root.children;
    }, [tags, filterText, customOrder]);

    const Highlight = ({ children }) => {
        if (!search || !children || typeof children !== 'string') return children;
        const lowerSearch = search.toLowerCase();
        const lowerChildren = children.toLowerCase();
        if (!lowerChildren.includes(lowerSearch)) return children;

        const parts = [];
        let currentIndex = 0;
        let matchIndex = lowerChildren.indexOf(lowerSearch);

        while (matchIndex !== -1) {
            if (matchIndex > currentIndex) {
                parts.push(children.slice(currentIndex, matchIndex));
            }
            parts.push(
                <span key={matchIndex} style={{ backgroundColor: "#ffeb3b", color: "#000" }}>
                    {children.slice(matchIndex, matchIndex + search.length)}
                </span>
            );
            currentIndex = matchIndex + search.length;
            matchIndex = lowerChildren.indexOf(lowerSearch, currentIndex);
        }
        if (currentIndex < children.length) {
            parts.push(children.slice(currentIndex));
        }
        return parts;
    };

    const TextRenderer = ({ children }) => {
        if (Array.isArray(children)) {
            return children.map((child, index) => <TextRenderer key={index}>{child}</TextRenderer>);
        }
        if (typeof children === 'string') {
            return <Highlight>{children}</Highlight>;
        }
        if (React.isValidElement(children)) {
            return React.cloneElement(children, {
                children: <TextRenderer>{children.props.children}</TextRenderer>
            });
        }
        return children;
    };

    // Components to wrap with highlighting
    const markdownComponents = {
        p: ({ children }) => <p><TextRenderer>{children}</TextRenderer></p>,
        li: ({ children }) => <li><TextRenderer>{children}</TextRenderer></li>,
        h1: ({ children }) => <h1><TextRenderer>{children}</TextRenderer></h1>,
        h2: ({ children }) => <h2><TextRenderer>{children}</TextRenderer></h2>,
        h3: ({ children }) => <h3><TextRenderer>{children}</TextRenderer></h3>,
        h4: ({ children }) => 4><h4><TextRenderer>{children}</TextRenderer></h4>,
        h5: ({ children }) => 5><h5><TextRenderer>{children}</TextRenderer></h5>,
        h6: ({ children }) => 6><h6><TextRenderer>{children}</TextRenderer></h6>,
        // This replaces the <br> tag with a styled <span>
        br: () => <span style={{ display: 'block', marginBottom: '1.2rem', content: '""' }} />
    };

    const sideBarContent = (
        <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
            <Box sx={{ p: 2, pb: 0 }}>
                <TextField
                    placeholder={translations.FILTER_TAGS || "Filter tags..."}
                    value={filterText}
                    onChange={(e) => setFilterText(e.target.value)}
                    fullWidth
                    size="small"
                    InputProps={{
                        startAdornment: (
                            <InputAdornment position="start">
                                <FilterAltIcon color="action" />
                            </InputAdornment>
                        )
                    }}
                />
            </Box>
            <List component="nav" sx={{ overflow: "auto", flex: 1, py: 1 }}>
                {tree.map(node => (
                    <TreeItem
                        key={node.id}
                        node={node}
                        onSelect={(tag) => {
                            if (!isMobile) onSelect(tag);
                            else {
                                onSelect(tag);
                                closeDrawer();
                            }
                        }}
                        selectedId={selectedTag?._id}
                        selectedPath={selectedTag ? getTagHierarchy(selectedTag).join("|") : null}
                    />
                ))}
            </List>
        </Box>
    );

    return (
        <Box sx={{ display: "flex", height: "100%", bgcolor: "background.default", position: "relative", gap: 2, p: 2 }}>
            {isMobile ? (
                <Drawer
                    anchor="left"
                    open={showLibrarySideBar}
                    onClose={closeDrawer}
                    ModalProps={{
                        keepMounted: true
                    }}
                    PaperProps={{
                        sx: {
                            width: "85vw",
                            maxWidth: 400,
                            bgcolor: "background.paper"
                        }
                    }}
                >
                    {sideBarContent}
                </Drawer>
            ) : (
                <Paper
                    elevation={3}
                    sx={{
                        width: showLibrarySideBar ? 400 : 0,
                        minWidth: showLibrarySideBar ? 400 : 0,
                        overflow: "hidden",
                        transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
                        display: "flex",
                        flexDirection: "column",
                        borderRadius: 4,
                        border: "1px solid",
                        borderColor: "divider",
                        bgcolor: "background.paper",
                        position: "relative",
                        boxShadow: showLibrarySideBar ? "0 8px 32px rgba(0,0,0,0.08)" : "none",
                        height: "100%",
                        opacity: showLibrarySideBar ? 1 : 0,
                        transform: showLibrarySideBar ? "translateX(0)" : "translateX(-20px)",
                        zIndex: 2
                    }}
                >
                    {sideBarContent}
                </Paper>
            )}

            <Paper
                elevation={2}
                sx={{
                    flex: 1,
                    height: "100%",
                    overflow: "hidden",
                    display: "flex",
                    flexDirection: "column",
                    borderRadius: 4,
                    border: "1px solid",
                    borderColor: "divider",
                    bgcolor: "background.paper",
                    boxShadow: "0 4px 20px rgba(0,0,0,0.04)"
                }}
            >
                {/* Fixed Header with Edit Button */}
                <Box sx={{
                    p: { xs: 2, md: 3 },
                    borderBottom: "1px solid",
                    borderColor: "divider",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    bgcolor: "background.default"
                }}>
                    <Box sx={{ flex: 1, pr: 2 }}>
                        {selectedTag ? (
                            <>
                                <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 1, flexWrap: "wrap" }}>
                                    {selectedTag.number && (
                                        <Box
                                            sx={{
                                                px: 1.5,
                                                py: 0.5,
                                                bgcolor: "primary.main",
                                                color: "primary.contrastText",
                                                borderRadius: 2,
                                                fontSize: "0.9rem",
                                                fontWeight: 800
                                            }}
                                        >
                                            {selectedTag.number}
                                        </Box>
                                    )}
                                    <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: -0.5, color: "text.primary" }}>
                                        {[selectedTag.article, selectedTag.title].filter(Boolean).join(" - ")}
                                    </Typography>
                                </Box>
                                <Box sx={{ display: "flex", alignItems: "center", gap: 1, color: "text.secondary", flexWrap: "wrap", fontSize: "0.9rem" }}>
                                    {selectedTag.chapter && (
                                        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                                            {selectedTag.chapter}
                                        </Typography>
                                    )}
                                    {selectedTag.chapter && <span>•</span>}
                                    <span>
                                        {[
                                            selectedTag.author,
                                            selectedTag.book,
                                            selectedTag.volume,
                                            selectedTag.part,
                                            selectedTag.section,
                                            selectedTag.year,
                                            selectedTag.portion
                                        ].filter(Boolean).join(" • ")}
                                    </span>
                                </Box>
                            </>
                        ) : (
                            <Typography variant="h6" color="text.secondary">
                                {translations.SELECT_ITEM || "Select an item"}
                            </Typography>
                        )}
                    </Box>

                    {isAdmin && selectedTag && (
                        <Tooltip title={translations.EDIT || "Edit"}>
                            <IconButton
                                onClick={openEditDialog}
                                sx={{
                                    bgcolor: "action.hover",
                                    "&:hover": {
                                        bgcolor: "primary.main",
                                        color: "primary.contrastText"
                                    }
                                }}
                            >
                                <EditIcon />
                            </IconButton>
                        </Tooltip>
                    )}
                </Box>

                <Box sx={{ flex: 1, p: { xs: 2, md: 4 }, overflow: "auto" }}>
                    {content ? (
                        <Box sx={{ maxWidth: 800, mx: "auto", position: "relative" }}>
                            <Box sx={{
                                "& p": { lineHeight: 1.8, mb: 2.5, fontSize: "1.05rem", color: "text.primary" },
                                "& h1, & h2, & h3": { mb: 2, mt: 4, fontWeight: 700 },
                                color: "text.primary"
                            }} className={styles.markdown}>
                                <ReactMarkdown
                                    remarkPlugins={[remarkBreaks]}
                                    components={markdownComponents}
                                >
                                    {content}
                                </ReactMarkdown>
                            </Box>
                        </Box>
                    ) : (
                        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", opacity: 0.5 }}>
                            <LibraryBooksIcon sx={{ fontSize: 64, mb: 2, color: "divider" }} />
                            <Typography variant="h6" color="textSecondary" sx={{ fontWeight: 600 }}>
                                {translations.SELECT_ITEM}
                            </Typography>
                        </Box>
                    )}
                </Box>
            </Paper>

            {/* Edit Tags Dialog */}
            <EditTagsDialog
                open={editDialogOpen}
                onClose={() => setEditDialogOpen(false)}
                selectedTag={selectedTag}
                tags={tags}
                setTags={setTags}
                setSelectedTag={setSelectedTag}
                setContent={setContent}
            />
        </Box>
    );
}
