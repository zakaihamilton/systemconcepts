import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useDeviceType } from "@util/styles";
import Fade from "@mui/material/Fade";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Paper from "@mui/material/Paper";
import Tooltip from "@mui/material/Tooltip";
import CircularProgress from "@mui/material/CircularProgress";
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
import { abbreviations } from "../../data/abbreviations";
import { useLanguage } from "@util/language";
import styles from "./Article.module.scss";


import clsx from "clsx";
import Player from "./Article/Player";
import JumpDialog from "./Article/JumpDialog";
import ArticleTermsDialog from "./Article/ArticleTermsDialog";
import { scanForTerms } from "./Article/GlossaryUtils";
import FormatListNumberedIcon from "@mui/icons-material/FormatListNumbered";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import Fab from "@mui/material/Fab";
import Zoom from "@mui/material/Zoom";

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
    openEditContentDialog,
    loading
}) {
    const deviceType = useDeviceType();
    const isPhone = deviceType === "phone";
    const [matchIndex, setMatchIndex] = useState(0);
    const [totalMatches, setTotalMatches] = useState(0);
    const [showPlaceholder, setShowPlaceholder] = useState(false);
    const [showMarkdown, setShowMarkdown] = useState(true);
    const [showAbbreviations, setShowAbbreviations] = useState(true);
    const language = useLanguage();
    const [scrollInfo, setScrollInfo] = useState({ page: 1, total: 1, visible: false, clientHeight: 0, scrollHeight: 0 });
    const scrollTimeoutRef = useRef(null);
    const [currentTTSParagraph, setCurrentTTSParagraph] = useState(-1);
    const [jumpDialogOpen, setJumpDialogOpen] = useState(false);
    const [termsDialogOpen, setTermsDialogOpen] = useState(false);
    const [articleTerms, setArticleTerms] = useState([]);
    const [showScrollTop, setShowScrollTop] = useState(false);
    const [totalParagraphs, setTotalParagraphs] = useState(0);

    const handleJump = useCallback((type, value) => {
        setJumpDialogOpen(false);
        setTimeout(() => {
            if (contentRef.current) {
                contentRef.current.focus();
            }
            if (type === 'paragraph') {
                const element = contentRef.current.querySelector(`[data-paragraph-index="${value}"]`);
                if (element) {
                    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    element.classList.add(styles.highlightedParagraph);
                    setTimeout(() => {
                        element.classList.remove(styles.highlightedParagraph);
                    }, 2000);
                }
            } else if (type === 'page') {
                if (contentRef.current && scrollInfo.clientHeight > 0) {
                    const scrollTop = (value - 1) * scrollInfo.clientHeight;
                    contentRef.current.scrollTo({ top: scrollTop, behavior: 'smooth' });
                }
            }
        }, 100);
    }, [contentRef, scrollInfo]);

    const handleShowTerms = useCallback(() => {
        const terms = scanForTerms(content);
        setArticleTerms(terms);
        setTermsDialogOpen(true);
    }, [content]);

    const scrollToTop = useCallback(() => {
        if (contentRef.current) {
            contentRef.current.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }, [contentRef]);

    const updateScrollInfo = useCallback((target) => {
        const { scrollTop, scrollHeight, clientHeight } = target;
        if (clientHeight === 0) return;

        const total = Math.ceil(scrollHeight / clientHeight);
        let page = Math.ceil((scrollTop + clientHeight / 4) / clientHeight) || 1;
        if (scrollTop + clientHeight >= scrollHeight - 1) {
            page = total;
        }

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

        // Count paragraphs
        const paragraphs = element.querySelectorAll('[data-paragraph-index]');
        setTotalParagraphs(paragraphs.length);

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
            setTimeout(() => setShowPlaceholder(false), 0);
        }
    }, [content, selectedTag]);

    useEffect(() => {
        setTimeout(() => setScrollInfo({ page: 1, total: 1, visible: false, clientHeight: 0, scrollHeight: 0 }), 0);
    }, [selectedTag?._id]);

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

        const cssStyles = Array.from(document.querySelectorAll("style, link[rel='stylesheet']"))
            .map(node => node.outerHTML)
            .join("");

        const doc = iframe.contentWindow.document;
        doc.open();
        doc.write(`
            <!DOCTYPE html>
            <html>
            <head>
                ${cssStyles}
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
                <div class="${styles.root}">
                    ${rootElement.outerHTML}
                </div>
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
    }, [contentRef]);

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
        setTimeout(() => setTotalMatches(highlights.length), 0);
        if (highlights.length > 0) {
            setTimeout(() => {
                setMatchIndex(prev => {
                    const index = prev >= highlights.length ? 0 : prev;
                    scrollToMatch(index);
                    return index;
                });
            }, 0);
        }
    }, [content, search, scrollToMatch]);


    const handleTTSParagraphChange = useCallback((index, element) => {
        setCurrentTTSParagraph(index);
    }, []);



    const toolbarItems = useMemo(() => {
        if (!content || !selectedTag) {
            return [];
        }
        let items = [
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
            },
            {
                id: "toggleAbbreviations",
                name: showAbbreviations ? translations.SHOW_FULL_TERMS : translations.SHOW_ABBREVIATIONS,
                icon: <LibraryBooksIcon />,
                onClick: () => setShowAbbreviations(prev => !prev),
                menu: true
            }
        ];
        if (isAdmin) {
            items = [
                ...items,
                {
                    id: "editTags",
                    name: translations.EDIT_TAGS,
                    icon: <EditIcon />,
                    onClick: openEditDialog,
                    menu: true
                },
                {
                    id: "editArticle",
                    name: translations.EDIT_ARTICLE,
                    icon: <ArticleIcon />,
                    onClick: openEditContentDialog,
                    menu: true
                },
                {
                    id: "jumpToParagraph",
                    name: translations.JUMP_TO,
                    icon: <FormatListNumberedIcon />,
                    onClick: () => setJumpDialogOpen(true),
                    menu: true
                },
                {
                    id: "articleTerms",
                    name: translations.ARTICLE_TERMS,
                    icon: <MenuBookIcon />,
                    onClick: handleShowTerms,
                    menu: true
                }
            ];
        }
        if (search && totalMatches > 0) {
            items = [
                ...items,
                {
                    id: "prevMatch",
                    name: translations.PREVIOUS_MATCH,
                    icon: <KeyboardArrowUpIcon />,
                    onClick: handlePrevMatch,
                    location: isPhone ? "header" : undefined
                },
                {
                    id: "matchCount",
                    name: `${matchIndex + 1} / ${totalMatches}`,
                    element: <Typography key="matchCount" variant="caption" sx={{ alignSelf: "center", mx: 1, color: "var(--text-secondary)", fontWeight: "bold" }}>{matchIndex + 1} / {totalMatches}</Typography>,
                    location: isPhone ? "header" : undefined
                },
                {
                    id: "nextMatch",
                    name: translations.NEXT_MATCH,
                    icon: <KeyboardArrowDownIcon />,
                    onClick: handleNextMatch,
                    location: isPhone ? "header" : undefined
                }
            ];
        }
        return items;
    }, [translations, handleExport, handlePrint, isAdmin, openEditDialog, openEditContentDialog, search, totalMatches, matchIndex, handlePrevMatch, handleNextMatch, showMarkdown, content, selectedTag, isPhone, handleShowTerms, showAbbreviations]);

    useToolbar({
        id: "Article",
        items: toolbarItems,
        visible: !!content,
        depends: [toolbarItems, content]
    });

    const getTitle = () => {
        if (!selectedTag) return { name: "", key: "" };
        for (let i = LibraryTagKeys.length - 1; i >= 0; i--) {
            const key = LibraryTagKeys[i];
            const value = selectedTag[key];
            if (value && String(value).trim()) {
                return { name: value, key };
            }
        }
        return { name: "", key: "" };
    };

    const title = getTitle();

    const processedContent = useMemo(() => {
        if (!content || showAbbreviations) return content;
        let text = content;
        // Sort keys by length descending to handle overlapping abbreviations
        const keys = Object.keys(abbreviations).sort((a, b) => b.length - a.length);
        for (const key of keys) {
            const expansion = abbreviations[key];
            if (!expansion) continue;
            // Replace standalone abbreviations, avoiding partial matches
            const regex = new RegExp(`\\b${key}\\b`, 'g');
            text = text.replace(regex, expansion.eng);
        }
        return text;
    }, [content, showAbbreviations]);

    if (loading) {
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
                <CircularProgress />
            </Box>
        );
    }

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
                <Box className={styles.placeholder}>
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
            className={styles.root}
            minWidth={0}
            sx={{
                ml: { sm: 2 },
                overflow: 'hidden !important',
                position: 'relative'
            }}
        >
            <Zoom in={showScrollTop}>
                <Box
                    sx={{
                        position: 'absolute',
                        top: 16,
                        left: 16,
                        zIndex: 1300
                    }}
                >
                    <Tooltip title={translations.SCROLL_TO_TOP || "Scroll to Top"} placement="right">
                        <Fab
                            color="primary"
                            size="small"
                            aria-label="scroll back to top"
                            onClick={scrollToTop}
                        >
                            <ArrowUpwardIcon />
                        </Fab>
                    </Tooltip>
                </Box>
            </Zoom>
            <Box
                ref={contentRef}
                tabIndex={-1}
                onScroll={(e) => {
                    if (handleScroll) handleScroll(e);
                    handleScrollUpdate(e);
                    setShowScrollTop(e.target.scrollTop > 300);
                }}
                sx={{
                    height: '100%',
                    overflowY: 'auto',
                    overflowX: 'hidden',
                    outline: 'none'
                }}
            >

                <Fade in={scrollInfo.visible} timeout={1000}>
                    <Paper
                        elevation={4}
                        sx={{
                            position: 'fixed',
                            top: 24,
                            right: 24,
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
                <Box className={clsx(styles.stickyHeader, isHeaderHidden && styles.hidden)}>
                    <Box className={styles.headerInfo}>
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
                                    {(() => {
                                        const expansion = abbreviations[title.name];
                                        return (!showAbbreviations && expansion) ? expansion.eng : title.name;
                                    })()}
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
                                        const expansion = abbreviations[value];
                                        const displayValue = (!showAbbreviations && expansion) ? expansion.eng : value;
                                        return (
                                            <Tooltip key={key} title={key.charAt(0).toUpperCase() + key.slice(1)} arrow>
                                                <Paper
                                                    elevation={0}
                                                    className={styles.metadataTag}
                                                    data-key={key}
                                                    onClick={() => navigator.clipboard.writeText(displayValue)}
                                                    sx={{ cursor: "pointer" }}
                                                >
                                                    {Icon && <Icon sx={{ fontSize: "1rem" }} />}
                                                    <Typography variant="caption">{displayValue}</Typography>
                                                </Paper>
                                            </Tooltip>
                                        );
                                    })}
                            </Box>
                        </Box>
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
                            opacity: 1.0,
                            pointerEvents: 'none'
                        }}
                    />
                ))}
                <Box className={styles.contentScrollArea}>
                    <Box className={styles.contentWrapper}>
                        {showMarkdown ? (
                            <Markdown search={search} currentTTSParagraph={currentTTSParagraph}>
                                {processedContent}
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
                                {processedContent}
                            </Box>
                        )}
                    </Box>
                </Box>

                {content && showMarkdown && (
                    <Player
                        contentRef={contentRef}
                        onParagraphChange={handleTTSParagraphChange}
                    />
                )}
                <JumpDialog
                    open={jumpDialogOpen}
                    onClose={() => setJumpDialogOpen(false)}
                    onSubmit={handleJump}
                    maxPage={scrollInfo.total}
                    maxParagraphs={totalParagraphs}
                />
                <ArticleTermsDialog
                    open={termsDialogOpen}
                    onClose={() => setTermsDialogOpen(false)}
                    terms={articleTerms}
                />
            </Box>
        </Box >
    );

}

export default React.memo(Article);
