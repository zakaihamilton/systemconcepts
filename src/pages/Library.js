import { useEffect, useState, useMemo } from "react";
import { useSearch } from "@components/Search";
import storage from "@util/storage";
import { LIBRARY_LOCAL_PATH } from "@sync/constants";
import { makePath } from "@util/path";
import Box from "@mui/material/Box";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import Collapse from "@mui/material/Collapse";
import ExpandLess from "@mui/icons-material/ExpandLess";
import ExpandMore from "@mui/icons-material/ExpandMore";
import Typography from "@mui/material/Typography";
import Paper from "@mui/material/Paper";
import Divider from "@mui/material/Divider";
import ReactMarkdown from 'react-markdown';
import { useTranslations } from "@util/translations";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import MenuOpenIcon from "@mui/icons-material/MenuOpen";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";

function TreeItem({ node, onSelect, selectedId, level = 0 }) {
    const [open, setOpen] = useState(false);
    const hasChildren = node.children && node.children.length > 0;
    const isSelected = node._id === selectedId;

    const handleClick = () => {
        if (hasChildren) {
            setOpen(!open);
        } else {
            onSelect(node);
        }
    };

    return (
        <>
            <ListItemButton
                onClick={handleClick}
                selected={isSelected}
                sx={{ pl: level * 2 + 2, py: 0.5 }}
            >
                <Box sx={{ display: "flex", alignItems: "center", flex: 1 }}>
                    {node.number && (
                        <Box
                            sx={{
                                mr: 1,
                                px: 0.6,
                                py: 0.2,
                                bgcolor: "primary.main",
                                color: "primary.contrastText",
                                borderRadius: 1.5,
                                fontSize: "0.75rem",
                                fontWeight: "bold",
                                minWidth: 20,
                                textAlign: "center",
                                opacity: 0.9,
                                boxShadow: 1
                            }}
                        >
                            {node.number}
                        </Box>
                    )}
                    <ListItemText
                        primary={node.name}
                        primaryTypographyProps={{
                            variant: "body2",
                            sx: { fontWeight: node.number ? "bold" : "regular" }
                        }}
                    />
                </Box>
                {hasChildren ? (open ? <ExpandLess /> : <ExpandMore />) : null}
            </ListItemButton>
            {hasChildren && (
                <Collapse in={open} timeout="auto" unmountOnExit>
                    <List component="div" disablePadding>
                        {node.children.map((child) => (
                            <TreeItem
                                key={child.id}
                                node={child}
                                onSelect={onSelect}
                                selectedId={selectedId}
                                level={level + 1}
                            />
                        ))}
                    </List>
                </Collapse>
            )}
        </>
    );
}

export default function Library() {
    const search = useSearch();
    const [tags, setTags] = useState([]);
    const [content, setContent] = useState(null);
    const [selectedTag, setSelectedTag] = useState(null);
    const translations = useTranslations();

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
                    // data is likely an array of objects or an object with text?
                    // User said: "find the matching content object where the "text" field is the content to display"
                    // We need to find object with _id matching selectedTag._id
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

    const [showSidebar, setShowSidebar] = useState(true);

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
                tag.chapter,
                tag.article,
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
                    width: showSidebar ? "30%" : 0,
                    minWidth: showSidebar ? 250 : 0,
                    overflow: "hidden",
                    borderRight: showSidebar ? "1px solid #ccc" : "none",
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
                            onSelect={setSelectedTag}
                            selectedId={selectedTag?._id}
                        />
                    ))}
                </List>
            </Paper>

            <Box sx={{ flex: 1, p: 3, overflow: "auto", position: "relative" }}>
                {!showSidebar && (
                    <Tooltip title={translations.SHOW_SIDEBAR || "Show Sidebar"}>
                        <IconButton
                            onClick={() => setShowSidebar(true)}
                            sx={{ position: "absolute", left: 8, top: 8, zIndex: 10 }}
                        >
                            <MenuOpenIcon />
                        </IconButton>
                    </Tooltip>
                )}
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
    );
}
