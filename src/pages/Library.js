import { useEffect, useState, useMemo } from "react";
import { useSearch } from "@components/Search";
import storage from "@util/storage";
import { LIBRARY_LOCAL_PATH } from "@sync/constants";
import { makePath } from "@util/path";
import Box from "@mui/material/Box";
import List from "@mui/material/List";
import Typography from "@mui/material/Typography";
import Paper from "@mui/material/Paper";
import Divider from "@mui/material/Divider";
import ReactMarkdown from 'react-markdown';
import { useTranslations } from "@util/translations";
import LibraryBooksIcon from "@mui/icons-material/LibraryBooks";
import TreeItem from "./Library/TreeItem";
import { setPath, usePathItems } from "@util/pages";
import { MainStore } from "@components/Main";
import { LibraryStore } from "./Library/Store";
import { LibraryIcons, LibraryTagKeys } from "./Library/Icons";


export default function Library() {
    const search = useSearch();
    const [tags, setTags] = useState([]);
    const [content, setContent] = useState(null);
    const [selectedTag, setSelectedTag] = useState(null);
    const translations = useTranslations();
    const pathItems = usePathItems();

    const getTagHierarchy = (tag) => {
        return LibraryTagKeys.map(key => tag[key]).map(v => v ? String(v).trim() : null).filter(Boolean);
    };

    const onSelect = (tag) => {
        setSelectedTag(tag);
        const hierarchy = getTagHierarchy(tag);
        if (hierarchy.length > 0) {
            setPath("library", ...hierarchy);
        }
    };

    useEffect(() => {
        if (tags.length > 0 && pathItems.length > 1 && pathItems[0] === "library") {
            const urlPath = pathItems.slice(1).join("|");
            const tag = tags.find(t => getTagHierarchy(t).join("|") === urlPath);
            if (tag) {
                setSelectedTag(tag);
            }
        }
    }, [tags, pathItems]);

    useEffect(() => {
        async function loadTags() {
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
        }
        loadTags();
    }, []);

    useEffect(() => {
        async function loadContent() {
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
        }
        loadContent();
    }, [selectedTag]);

    const { showLibrarySideBar } = MainStore.useState();

    const setShowSidebar = (show) => {
        MainStore.update(s => {
            s.showLibrarySideBar = show;
        });
    };

    const tree = useMemo(() => {
        const root = { id: "root", name: "Library", children: [] };

        let filteredTags = tags;
        if (search) {
            const lowerSearch = search.toLowerCase();
            const keysToSearch = [...LibraryTagKeys, "number"];
            filteredTags = tags.filter(tag =>
                keysToSearch.some(key => {
                    const value = tag[key];
                    return value && String(value).toLowerCase().includes(lowerSearch);
                })
            );
        }

        for (const tag of filteredTags) {
            let currentLevel = root.children;
            const levels = LibraryTagKeys.map(key => tag[key]).map(v => v ? String(v).trim() : null).filter(Boolean);
            if (levels.length === 0) continue;

            const pathIds = [];
            levels.forEach((name, index) => {
                const isHead = index < levels.length - 1;
                pathIds.push(name);
                const id = pathIds.join("|");

                let node = currentLevel.find(n => n.id === id);
                if (!node) {
                    const type = LibraryTagKeys.find(key => tag[key] && String(tag[key]).trim() === name);
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
        return root.children;
    }, [tags, search]);


    return (
        <Box sx={{ display: "flex", height: "100%", bgcolor: "background.default", position: "relative", gap: 2, p: 2 }}>
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
                <List component="nav" sx={{ overflow: "auto", flex: 1, minWidth: 400, py: 1 }}>
                    {tree.map(node => (
                        <TreeItem
                            key={node.id}
                            node={node}
                            onSelect={onSelect}
                            selectedId={selectedTag?._id}
                            selectedPath={selectedTag ? getTagHierarchy(selectedTag).join("|") : null}
                        />
                    ))}
                </List>
            </Paper>

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
                <Box sx={{ flex: 1, p: { xs: 2, md: 4 }, overflow: "auto" }}>
                    {content ? (
                        <Box sx={{ maxWidth: 800, mx: "auto" }}>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2, flexWrap: "wrap" }}>
                                {selectedTag?.number && (
                                    <Box
                                        sx={{
                                            px: 1.5,
                                            py: 0.5,
                                            bgcolor: "primary.main",
                                            color: "primary.contrastText",
                                            borderRadius: 2,
                                            fontSize: "0.9rem",
                                            fontWeight: 800,
                                            boxShadow: "0 4px 12px rgba(var(--primary-rgb), 0.3)"
                                        }}
                                    >
                                        {selectedTag.number}
                                    </Box>
                                )}
                                <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: -1, color: "text.primary" }}>
                                    {[selectedTag?.article, selectedTag?.title].filter(Boolean).join(" - ")}
                                </Typography>
                            </Box>

                            <Box sx={{ display: "flex", alignItems: "center", gap: 1, color: "text.secondary", mb: 3, flexWrap: "wrap" }}>
                                {selectedTag?.chapter && (
                                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                                        {selectedTag.chapter}
                                    </Typography>
                                )}
                                {selectedTag?.chapter && <Typography variant="subtitle1">•</Typography>}
                                <Typography variant="subtitle1" sx={{ opacity: 0.8 }}>
                                    {[
                                        selectedTag?.author,
                                        selectedTag?.book,
                                        selectedTag?.volume,
                                        selectedTag?.part,
                                        selectedTag?.section,
                                        selectedTag?.year,
                                        selectedTag?.portion
                                    ].filter(Boolean).join(" • ")}
                                </Typography>
                            </Box>

                            <Divider sx={{ mb: 4, opacity: 0.6 }} />

                            <Box sx={{
                                "& p": { lineHeight: 1.8, mb: 2.5, fontSize: "1.05rem", color: "text.primary" },
                                "& h1, & h2, & h3": { mb: 2, mt: 4, fontWeight: 700 },
                                color: "text.primary"
                            }}>
                                <ReactMarkdown>{content}</ReactMarkdown>
                            </Box>
                        </Box>
                    ) : (
                        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", opacity: 0.5 }}>
                            <LibraryBooksIcon sx={{ fontSize: 64, mb: 2, color: "divider" }} />
                            <Typography variant="h6" color="textSecondary" sx={{ fontWeight: 600 }}>
                                {translations.SELECT_ITEM || "Select a chapter to view content"}
                            </Typography>
                        </Box>
                    )}
                </Box>
            </Paper>
        </Box>
    );
}
