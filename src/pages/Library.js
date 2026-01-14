import React, { useEffect, useState, useCallback } from "react";
import { useSearch } from "@components/Search";
import storage from "@util/storage";
import { LIBRARY_LOCAL_PATH } from "@sync/constants";
import { makePath } from "@util/path";
import Box from "@mui/material/Box";
import { useTranslations } from "@util/translations";
import { setPath, usePathItems } from "@util/pages";
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
    }, [getTagHierarchy]);

    useEffect(() => {
        if (tags.length > 0 && pathItems.length > 1 && pathItems[0] === "library") {
            const urlPath = pathItems.slice(1).join("|");
            const tag = tags.find(t => getTagHierarchy(t).join("|") === urlPath);
            if (tag) {
                setSelectedTag(tag);
            }
        }
    }, [tags, pathItems, getTagHierarchy]);

    const [customOrder, setCustomOrder] = useState({});
    const libraryUpdateCounter = SyncActiveStore.useState(s => s.libraryUpdateCounter);

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
                setContent(item ? item.text : "Content not found in file.");
            } else {
                setContent("File not found.");
            }
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

    return (
        <Box className={styles.root}>
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
