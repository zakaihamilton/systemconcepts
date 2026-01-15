import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useDeviceType } from "@util/styles";
import Fade from "@mui/material/Fade";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Tooltip from "@mui/material/Tooltip";
import DownloadIcon from "@mui/icons-material/Download";
import EditIcon from "@mui/icons-material/Edit";
import CodeIcon from "@mui/icons-material/Code";
import CodeOffIcon from "@mui/icons-material/CodeOff";
import ArticleIcon from "@mui/icons-material/Article";
import PrintIcon from "@mui/icons-material/Print";
import LibraryBooksIcon from "@mui/icons-material/LibraryBooks";
import Markdown from "./Article/Markdown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import { LibraryTagKeys, LibraryIcons } from "./Icons";
import { exportData } from "@util/importExport";
import { useToolbar, registerToolbar } from "@components/Toolbar";
import styles from "./Article.module.scss";
import clsx from "clsx";

registerToolbar("Article");



function Article({
    selectedTag,
    content,
    search,
    translations,
    isAdmin,
    openEditDialog,
    isHeaderHidden,
    handleScroll,
    contentRef,
    handleDrawerToggle,
    openEditContentDialog,
}) {
    const deviceType = useDeviceType();
    const isPhone = deviceType === "phone";
    const [matchIndex, setMatchIndex] = useState(0);
    const [totalMatches, setTotalMatches] = useState(0);
    const [showPlaceholder, setShowPlaceholder] = useState(false);
    const [showMarkdown, setShowMarkdown] = useState(true);
    const [scrollInfo, setScrollInfo] = useState({ page: 1, total: 1, visible: false, clientHeight: 0, scrollHeight: 0 });
    const scrollTimeoutRef = useRef(null);

    const updateScrollInfo = useCallback((target) => {
        const { scrollTop, scrollHeight, clientHeight } = target;
        if (clientHeight === 0) return;

        const total = Math.ceil(scrollHeight / clientHeight);
        const page = Math.ceil((scrollTop + clientHeight / 2) / clientHeight) || 1;

        setScrollInfo(prev => {
            if (prev.page !== page || prev.total !== total || prev.clientHeight !== clientHeight || prev.scrollHeight !== scrollHeight) {
                return { ...prev, page, total, clientHeight, scrollHeight };
            }
            return prev;
        });
    }, []);

    const handleScrollUpdate = useCallback((e) => {
        updateScrollInfo(e.target);

        setScrollInfo(prev => {
            if (!prev.visible) return { ...prev, visible: true };
            return prev;
        });

        if (scrollTimeoutRef.current) {
            clearTimeout(scrollTimeoutRef.current);
        }

        scrollTimeoutRef.current = setTimeout(() => {
            setScrollInfo(prev => ({ ...prev, visible: false }));
        }, 1500);
    }, [updateScrollInfo]);

    useEffect(() => {
        const element = contentRef.current;
        if (!element) return;

        const observer = new ResizeObserver(() => {
            updateScrollInfo(element);
        });
        observer.observe(element);
        return () => observer.disconnect();
    }, [content, updateScrollInfo, contentRef]);

    // Delay showing the placeholder to avoid flash during loading
    useEffect(() => {
        if (!content && !selectedTag) {
            const timer = setTimeout(() => {
                setShowPlaceholder(true);
            }, 300);
            return () => clearTimeout(timer);
        } else {
            setShowPlaceholder(false);
        }
    }, [content, selectedTag]);

    const formatArticleWithTags = useCallback((tag, text) => {
        if (!tag) return text;
        const metadata = LibraryTagKeys
            .map(key => {
                const val = tag[key];
                if (!val) return null;
                const label = key.charAt(0).toUpperCase() + key.slice(1);
                return `${label}: ${val}`;
            })
            .filter(Boolean)
            .join("\n");

        return `${metadata}\n\n${"=".repeat(20)}\n\n${text || ""}`;
    }, []);

    const handlePrint = useCallback(() => {
        const rootElement = contentRef.current;
        if (!rootElement) return;

        const iframe = document.createElement("iframe");
        Object.assign(iframe.style, {
            position: "absolute",
            top: "-9999px",
            left: "-9999px",
            width: "100%",
            height: "auto"
        });
        document.body.appendChild(iframe);

        const styles = Array.from(document.querySelectorAll("style, link[rel='stylesheet']"))
            .map(node => node.outerHTML)
            .join("");

        const doc = iframe.contentWindow.document;
        doc.open();
        doc.write(`
            <!DOCTYPE html>
            <html>
            <head>
                ${styles}
                <style>
                    :global(body), html, body {
                        background: white !important;
                        height: auto !important;
                        overflow: visible !important;
                        width: 100% !important;
                    }
                    /* Ensure the cloned root is visible and resets layout */
                    [class*="Article_root"] {
                        position: static !important;
                        height: auto !important;
                        overflow: visible !important;
                        display: block !important;
                        visibility: visible !important;
                        margin: 0 !important;
                        padding: 20px !important;
                        width: 100% !important;
                    }
                    @media print {
                        body { -webkit-print-color-adjust: exact; }
                    }
                </style>
            </head>
            <body>
                ${rootElement.outerHTML}
                <script>
                    window.onload = () => {
                        setTimeout(() => {
                            window.print();
                            // Clean up after print dialog closes (approximate)
                            setTimeout(() => {
                                window.top.postMessage("print-complete", "*");
                            }, 1000);
                        }, 500);
                    };
                </script>
            </body>
            </html>
        `);
        doc.close();

        const cleanup = (e) => {
            if (e.data === "print-complete") {
                setTimeout(() => {
                    if (document.body.contains(iframe)) {
                        document.body.removeChild(iframe);
                    }
                }, 5000); // Wait longer to ensure print is done
                window.removeEventListener("message", cleanup);
            }
        };
        window.addEventListener("message", cleanup);
    }, []);

    const handleExport = useCallback(() => {
        if (!selectedTag || !content) return;
        const formatted = formatArticleWithTags(selectedTag, content);
        const filename = `${selectedTag.article || "Article"}${selectedTag.number ? `_${selectedTag.number}` : ""}.md`;
        exportData(formatted, filename, "text/plain");
    }, [selectedTag, content, formatArticleWithTags]);


    const scrollToMatch = useCallback((index) => {
        const highlights = document.querySelectorAll('.search-highlight');
        if (highlights[index]) {
            highlights[index].scrollIntoView({ behavior: 'smooth', block: 'center' });
            highlights[index].style.outline = "2px solid #ff9800";
            highlights[index].style.borderRadius = "2px";
            setTimeout(() => {
                if (highlights[index]) {
                    highlights[index].style.outline = "none";
                }
            }, 2000);
        }
    }, []);

    const handleNextMatch = useCallback(() => {
        if (totalMatches === 0) return;
        setMatchIndex(prev => {
            const next = (prev + 1) % totalMatches;
            scrollToMatch(next);
            return next;
        });
    }, [totalMatches, scrollToMatch]);

    const handlePrevMatch = useCallback(() => {
        if (totalMatches === 0) return;
        setMatchIndex(prev => {
            const next = (prev - 1 + totalMatches) % totalMatches;
            scrollToMatch(next);
            return next;
        });
    }, [totalMatches, scrollToMatch]);

    useEffect(() => {
        const highlights = document.querySelectorAll('.search-highlight');
        setTotalMatches(highlights.length);
        if (highlights.length > 0) {
            setMatchIndex(prev => {
                const index = prev >= highlights.length ? 0 : prev;
                scrollToMatch(index);
                return index;
            });
        }
    }, [content, search, scrollToMatch]);



    const toolbarItems = useMemo(() => {
        if (!content || !selectedTag) {
            return [];
        }
        const items = [
            {
                id: "export",
                name: showMarkdown ? translations.PRINT : translations.EXPORT_TO_MD,
                icon: showMarkdown ? <PrintIcon /> : <DownloadIcon />,
                onClick: showMarkdown ? handlePrint : handleExport,
                menu: true
            },
            {
                id: "toggleMarkdown",
                name: showMarkdown ? translations.VIEW_PLAIN_TEXT : translations.VIEW_MARKDOWN,
                icon: showMarkdown ? <CodeOffIcon /> : <CodeIcon />,
                onClick: () => setShowMarkdown(prev => !prev),
                menu: true
            }
        ];
        if (isAdmin) {
            items.push({
                id: "editTags",
                name: translations.EDIT_TAGS,
                icon: <EditIcon />,
                onClick: openEditDialog,
                menu: true
            });
            items.push({
                id: "editArticle",
                name: translations.EDIT_ARTICLE,
                icon: <ArticleIcon />,
                onClick: openEditContentDialog,
                menu: true
            });
        }
        if (search && totalMatches > 0) {
            items.push({
                id: "prevMatch",
                name: translations.PREVIOUS_MATCH,
                icon: <KeyboardArrowUpIcon />,
                onClick: handlePrevMatch,
                location: isPhone ? "header" : undefined
            });
            items.push({
                id: "matchCount",
                name: `${matchIndex + 1} / ${totalMatches}`,
                element: <Typography key="matchCount" variant="caption" sx={{ alignSelf: "center", mx: 1, color: "var(--text-secondary)", fontWeight: "bold" }}>{matchIndex + 1} / {totalMatches}</Typography>,
                location: isPhone ? "header" : undefined
            });
            items.push({
                id: "nextMatch",
                name: translations.NEXT_MATCH,
                icon: <KeyboardArrowDownIcon />,
                onClick: handleNextMatch,
                location: isPhone ? "header" : undefined
            });
        }
        return items;
    }, [translations, handleExport, handlePrint, isAdmin, openEditDialog, openEditContentDialog, search, totalMatches, matchIndex, handlePrevMatch, handleNextMatch, showMarkdown, content, selectedTag, isPhone]);

    useToolbar({
        id: "Article",
        items: toolbarItems,
        visible: !!content,
        depends: [toolbarItems, content]
    });

    const title = useMemo(() => {
        if (!selectedTag) return { name: "", key: "" };
        for (let i = LibraryTagKeys.length - 1; i >= 0; i--) {
            const key = LibraryTagKeys[i];
            const value = selectedTag[key];
            if (value && String(value).trim()) {
                return { name: value, key };
            }
        }
        return { name: "", key: "" };
    }, [selectedTag]);

    if (!content && showPlaceholder) {
        return (
            <Box
                component="main"
                className={styles.root}
                sx={{
                    ml: { sm: 2 },
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center"
                }}
            >
                <Box className={styles.placeholder} onClick={handleDrawerToggle}>
                    <LibraryBooksIcon />
                    <Typography component="p">{translations.SELECT_ITEM}</Typography>
                </Box>
            </Box>
        );
    }

    if (!content) {
        return null;
    }

    return (
        <Box
            component="main"
            ref={contentRef}
            onScroll={(e) => {
                if (handleScroll) handleScroll(e);
                handleScrollUpdate(e);
            }}
            className={styles.root}
            minWidth={0}
            sx={{
                ml: { sm: 2 }
            }}
        >
            <Box className={clsx(styles.stickyHeader, isHeaderHidden && styles.hidden)}>
                <Box className={styles.headerInfo}>
                    <IconButton
                        color="inherit"
                        aria-label="open drawer"
                        edge="start"
                        onClick={handleDrawerToggle}
                        sx={{ display: { sm: "none" } }}
                    >
                        <LibraryBooksIcon />
                    </IconButton>
                    <Box className={styles.headerTitleWrapper}>
                        <Box className={styles.titleRow}>
                            {selectedTag?.number && (
                                <Paper
                                    elevation={0}
                                    className={styles.tagNumber}
                                    component="span"
                                >
                                    #{selectedTag.number}
                                </Paper>
                            )}
                            {" "}
                            <Typography
                                variant="h4"
                                className={styles.title}
                                component="span"
                            >
                                {title.name}
                            </Typography>
                        </Box>
                        <Box className={styles.metadataRow}>
                            {LibraryTagKeys.filter(key => key !== "book" && key !== "author")
                                .concat(["book", "author"])
                                .map(key => {
                                    if (!selectedTag?.[key] || key === "number") return null;
                                    if (title.key === key) return null;
                                    const value = selectedTag[key];
                                    if (title.name === value) return null;
                                    const Icon = LibraryIcons[key];
                                    return (
                                        <Tooltip key={key} title={key.charAt(0).toUpperCase() + key.slice(1)} arrow>
                                            <Paper
                                                elevation={0}
                                                className={styles.metadataTag}
                                                onClick={() => navigator.clipboard.writeText(value)}
                                                sx={{ cursor: "pointer" }}
                                            >
                                                {Icon && <Icon sx={{ fontSize: "1rem" }} />}
                                                <Typography variant="caption">{value}</Typography>
                                            </Paper>
                                        </Tooltip>
                                    );
                                })}
                        </Box>
                    </Box>
                </Box>
            </Box>

            <Box className={styles.contentScrollArea}>
                <Box className={styles.contentWrapper}>
                    {showMarkdown ? (
                        <Markdown search={search}>
                            {content}
                        </Markdown>
                    ) : (
                        <Box
                            component="pre"
                            sx={{
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-word',
                                fontFamily: 'inherit',
                                fontSize: 'inherit',
                                lineHeight: 1.6,
                                margin: 0
                            }}
                        >
                            {content}
                        </Box>
                    )}
                </Box>
            </Box>
            {scrollInfo.clientHeight > 0 && Array.from({ length: Math.max(0, scrollInfo.total - 1) }).map((_, i) => (
                <Box
                    key={i}
                    sx={{
                        position: 'absolute',
                        top: (i + 1) * scrollInfo.clientHeight,
                        left: 0,
                        right: 0,
                        height: '1px',
                        borderTop: '2px dashed var(--divider)',
                        opacity: 0.5,
                        zIndex: 5,
                        pointerEvents: 'none'
                    }}
                />
            ))}
            <Fade in={scrollInfo.visible}>
                <Paper
                    elevation={4}
                    sx={{
                        position: 'fixed',
                        bottom: 24,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        zIndex: 1400,
                        px: 2,
                        py: 1,
                        borderRadius: 4,
                        backgroundColor: 'rgba(0,0,0,0.7)',
                        color: 'white',
                        backdropFilter: 'blur(4px)',
                        pointerEvents: 'none'
                    }}
                >
                    <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                        Page {scrollInfo.page} / {scrollInfo.total}
                    </Typography>
                </Paper>
            </Fade>
        </Box>
    );
}

export default React.memo(Article);
