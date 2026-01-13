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
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import MenuOpenIcon from "@mui/icons-material/MenuOpen";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import TreeItem from "./Library/TreeItem";
import { setPath, usePathItems } from "@util/pages";
import { MainStore } from "@components/Main";


export default function Library() {
    const search = useSearch();
    const [tags, setTags] = useState([]);
    const [content, setContent] = useState(null);
    const [selectedTag, setSelectedTag] = useState(null);
    const translations = useTranslations();
    const pathItems = usePathItems();

    const getTagHierarchy = (tag) => {
        return [
            tag.author,
            tag.book,
            tag.volume,
            tag.part,
            tag.section,
            tag.year,
            tag.portion,
            tag.article,
            tag.chapter,
            tag.title
        ].map(v => v ? String(v).trim() : null).filter(Boolean);
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
            const keysToSearch = ["author", "book", "volume", "part", "section", "year", "portion", "chapter", "article", "number", "title"];
            filteredTags = tags.filter(tag =>
                keysToSearch.some(key => {
                    const value = tag[key];
                    return value && String(value).toLowerCase().includes(lowerSearch);
                })
            );
        }

        for (const tag of filteredTags) {
            let currentLevel = root.children;
            const levels = [
                tag.author,
                tag.book,
                tag.volume,
                tag.part,
                tag.section,
                tag.year,
                tag.portion,
                tag.article,
                tag.chapter,
                tag.title
            ].map(v => v ? String(v).trim() : null).filter(Boolean);
            if (levels.length === 0) continue;

            const pathIds = [];
            levels.forEach((name, index) => {
                const isHead = index < levels.length - 1;
                pathIds.push(name);
                const id = pathIds.join("|");

                let node = currentLevel.find(n => n.id === id);
                if (!node) {
                    node = {
                        id,
                        name,
                        children: [],
                        number: (name === tag.article) ? tag.number : null,
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
        <Box sx={{ display: "flex", height: "100%", overflow: "hidden", position: "relative" }}>
            <Paper
                elevation={3}
                sx={{
                    width: showLibrarySideBar ? "30%" : 0,
                    minWidth: showLibrarySideBar ? 250 : 0,
                    overflow: "hidden",
                    borderRight: showLibrarySideBar ? "1px solid #ccc" : "none",
                    transition: "width 0.3s ease, min-width 0.3s ease",
                    display: "flex",
                    flexDirection: "column"
                }}
            >
                <Box sx={{ p: 2, display: "flex", alignItems: "center", justifyContent: "space-between", minWidth: 250 }}>
                    <Typography variant="h6">
                        {translations.LIBRARY || "Library"}
                    </Typography>
                    <IconButton onClick={() => setShowSidebar(false)} size="small">
                        <ChevronLeftIcon />
                    </IconButton>
                </Box>
                <Divider />
                <List component="nav" sx={{ overflow: "auto", flex: 1, minWidth: 250 }}>
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

            <Box sx={{ flex: 1, height: "100%", overflow: "hidden", display: "flex", flexDirection: "column" }}>
                {!showLibrarySideBar && (
                    <Box sx={{ p: 1, borderBottom: "1px solid", borderColor: "divider", display: "flex", alignItems: "center" }}>
                        <Tooltip title={translations.SHOW_SIDEBAR || "Show Sidebar"}>
                            <IconButton onClick={() => setShowSidebar(true)} size="small">
                                <MenuOpenIcon />
                            </IconButton>
                        </Tooltip>
                        <Typography variant="body2" sx={{ ml: 1, fontWeight: "bold", color: "text.secondary" }}>
                            {translations.LIBRARY || "Library"}
                        </Typography>
                    </Box>
                )}
                <Box sx={{ flex: 1, p: 3, overflow: "auto" }}>
                    {content ? (
                        <Box>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1, flexWrap: "wrap" }}>
                                {selectedTag?.chapter && (
                                    <Typography variant="h5" color="textSecondary">
                                        {selectedTag.chapter}
                                    </Typography>
                                )}
                                {selectedTag?.chapter && (selectedTag?.article || selectedTag?.title) && (
                                    <Typography variant="h5" color="textSecondary">-</Typography>
                                )}
                                {selectedTag?.number && (
                                    <Box
                                        sx={{
                                            px: 1,
                                            py: 0.5,
                                            bgcolor: "primary.main",
                                            color: "primary.contrastText",
                                            borderRadius: 1.5,
                                            fontSize: "1rem",
                                            fontWeight: "bold",
                                            boxShadow: 2
                                        }}
                                    >
                                        {selectedTag.number}
                                    </Box>
                                )}
                                <Typography variant="h5" sx={{ fontWeight: "bold" }}>
                                    {[selectedTag?.article, selectedTag?.title].filter(Boolean).join(" - ")}
                                </Typography>
                            </Box>
                            <Typography variant="subtitle1" color="textSecondary" gutterBottom>
                                {[
                                    selectedTag?.author,
                                    selectedTag?.book,
                                    selectedTag?.volume,
                                    selectedTag?.part,
                                    selectedTag?.section,
                                    selectedTag?.year,
                                    selectedTag?.portion
                                ].filter(Boolean).join(" | ")}
                            </Typography>
                            <Divider sx={{ my: 2 }} />
                            <div style={{ lineHeight: 1.6 }}>
                                <ReactMarkdown>{content}</ReactMarkdown>
                            </div>
                        </Box>
                    ) : (
                        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
                            <Typography variant="body1" color="textSecondary">
                                Select a chapter to view content
                            </Typography>
                        </Box>
                    )}
                </Box>
            </Box>
        </Box>
    );
}
