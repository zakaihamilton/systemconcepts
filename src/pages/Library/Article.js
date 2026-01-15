import React, { useState, useMemo, useCallback, useEffect } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Divider from "@mui/material/Divider";
import Tooltip from "@mui/material/Tooltip";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DownloadIcon from "@mui/icons-material/Download";
import EditIcon from "@mui/icons-material/Edit";
import CodeIcon from "@mui/icons-material/Code";
import CodeOffIcon from "@mui/icons-material/CodeOff";
import ArticleIcon from "@mui/icons-material/Article";
import LibraryBooksIcon from "@mui/icons-material/LibraryBooks";
import ReactMarkdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import { LibraryTagKeys, LibraryIcons } from "./Icons";
import { exportData } from "@util/importExport";
import { useToolbar, registerToolbar } from "@components/Toolbar";
import styles from "./Article.module.scss";
import clsx from "clsx";

registerToolbar("Article");

const rehypeArticleEnrichment = () => {
    return (tree) => {
        // Split <p> nodes that contain <br> into multiple <p> nodes
        const visitAndSplit = (nodes) => {
            const newNodes = [];
            nodes.forEach(node => {
                if (node.type === "element" && node.tagName === "p") {
                    const segments = [];
                    let currentSegment = [];
                    node.children.forEach(child => {
                        if (child.type === "element" && child.tagName === "br") {
                            if (currentSegment.length > 0) {
                                segments.push(currentSegment);
                                currentSegment = [];
                            }
                        } else {
                            currentSegment.push(child);
                        }
                    });
                    if (currentSegment.length > 0) {
                        segments.push(currentSegment);
                    }

                    if (segments.length === 0) {
                        newNodes.push(node);
                    } else {
                        segments.forEach(seg => {
                            newNodes.push({
                                type: "element",
                                tagName: "p",
                                properties: { ...node.properties },
                                children: seg
                            });
                        });
                    }
                } else {
                    if (node.children) {
                        node.children = visitAndSplit(node.children);
                    }
                    newNodes.push(node);
                }
            });
            return newNodes;
        };

        if (tree.children) {
            tree.children = visitAndSplit(tree.children);
        }
    };
};

export default function Article({
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
    const [matchIndex, setMatchIndex] = useState(0);
    const [totalMatches, setTotalMatches] = useState(0);
    const [showPlaceholder, setShowPlaceholder] = useState(false);
    const [showMarkdown, setShowMarkdown] = useState(true);

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

    const handleCopy = useCallback(() => {
        if (!selectedTag || !content) return;
        const formatted = formatArticleWithTags(selectedTag, content);
        navigator.clipboard.writeText(formatted);
    }, [selectedTag, content, formatArticleWithTags]);

    const handleExport = useCallback(() => {
        if (!selectedTag || !content) return;
        const formatted = formatArticleWithTags(selectedTag, content);
        const filename = `${selectedTag.article || "Article"}_${selectedTag.number || ""}.txt`;
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

    const Highlight = useCallback(({ children }) => {
        if (!search || !children || typeof children !== 'string') return children;
        const lowerSearch = search.toLowerCase();
        const lowerChildren = children.toLowerCase();
        if (!lowerChildren.includes(lowerSearch)) return children;

        const parts = [];
        let currentIndex = 0;
        let matchIndexPos = lowerChildren.indexOf(lowerSearch);

        while (matchIndexPos !== -1) {
            if (matchIndexPos > currentIndex) {
                parts.push(children.slice(currentIndex, matchIndexPos));
            }
            parts.push(
                <span key={matchIndexPos} className="search-highlight" style={{ backgroundColor: "#ffeb3b", color: "#000" }}>
                    {children.slice(matchIndexPos, matchIndexPos + search.length)}
                </span>
            );
            currentIndex = matchIndexPos + search.length;
            matchIndexPos = lowerChildren.indexOf(lowerSearch, currentIndex);
        }
        if (currentIndex < children.length) {
            parts.push(children.slice(currentIndex));
        }
        return parts;
    }, [search]);

    const TextRenderer = useCallback(({ children }) => {
        if (Array.isArray(children)) {
            return children.map((child, idx) => <TextRenderer key={idx}>{child}</TextRenderer>);
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
    }, [Highlight]);

    const markdownComponents = useMemo(() => {
        return {
            p: ({ children, ...props }) => {
                if (!children || (Array.isArray(children) && children.length === 0)) return null;
                const childrenArray = React.Children.toArray(children);
                const hasContent = childrenArray.some(child => {
                    if (typeof child === "string") return child.trim().length > 0;
                    return true;
                });
                if (!hasContent) return null;

                return (
                    <Box sx={{ marginBottom: '12px' }}>
                        <TextRenderer>{children}</TextRenderer>
                    </Box>
                );
            },
            li: ({ children }) => (
                <Box component="li" sx={{ mb: 1, listStyle: "inherit" }}>
                    <TextRenderer>{children}</TextRenderer>
                </Box>
            ),
            h1: ({ children }) => <h1><TextRenderer>{children}</TextRenderer></h1>,
            h2: ({ children }) => <h2><TextRenderer>{children}</TextRenderer></h2>,
            h3: ({ children }) => <h3><TextRenderer>{children}</TextRenderer></h3>,
            h4: ({ children }) => <h4><TextRenderer>{children}</TextRenderer></h4>,
            h5: ({ children }) => <h5><TextRenderer>{children}</TextRenderer></h5>,
            h6: ({ children }) => <h6><TextRenderer>{children}</TextRenderer></h6>,
            br: () => <span style={{ display: "block", marginBottom: "1.2rem", content: '""' }} />
        };
    }, [TextRenderer]);

    const toolbarItems = useMemo(() => {
        const items = [
            {
                id: "copy",
                name: translations.COPY_TO_CLIPBOARD || "Copy to Clipboard",
                icon: <ContentCopyIcon />,
                onClick: handleCopy
            },
            {
                id: "export",
                name: translations.EXPORT_TO_TXT || "Export to .txt",
                icon: <DownloadIcon />,
                onClick: handleExport,
                menu: true
            },
            {
                id: "toggleMarkdown",
                name: showMarkdown ? (translations.VIEW_PLAIN_TEXT || "View Plain Text") : (translations.VIEW_MARKDOWN || "View Markdown"),
                icon: showMarkdown ? <CodeOffIcon /> : <CodeIcon />,
                onClick: () => setShowMarkdown(prev => !prev),
                menu: true
            }
        ];
        if (isAdmin) {
            items.push({
                id: "editTags",
                name: translations.EDIT_TAGS || "Edit Tags",
                icon: <EditIcon />,
                onClick: openEditDialog,
                menu: true
            });
            items.push({
                id: "editArticle",
                name: translations.EDIT_ARTICLE || "Edit Article",
                icon: <ArticleIcon />,
                onClick: openEditContentDialog,
                menu: true
            });
        }
        if (search && totalMatches > 0) {
            items.push({
                id: "prevMatch",
                name: translations.PREVIOUS_MATCH || "Previous Match",
                icon: <KeyboardArrowUpIcon />,
                onClick: handlePrevMatch,
                location: "header"
            });
            items.push({
                id: "matchCount",
                name: `${matchIndex + 1} / ${totalMatches}`,
                element: <Typography key="matchCount" variant="caption" sx={{ alignSelf: "center", mx: 1, color: "var(--text-secondary)", fontWeight: "bold" }}>{matchIndex + 1} / {totalMatches}</Typography>,
                location: "header"
            });
            items.push({
                id: "nextMatch",
                name: translations.NEXT_MATCH || "Next Match",
                icon: <KeyboardArrowDownIcon />,
                onClick: handleNextMatch,
                location: "header"
            });
        }
        return items;
    }, [translations, handleCopy, handleExport, isAdmin, openEditDialog, openEditContentDialog, search, totalMatches, matchIndex, handlePrevMatch, handleNextMatch, showMarkdown]);

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
            onScroll={handleScroll}
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
                                >
                                    #{selectedTag.number}
                                </Paper>
                            )}
                            <Typography
                                variant="h4"
                                className={styles.title}
                                sx={{ flex: 1 }}
                            >
                                {title.name}
                            </Typography>
                        </Box>
                        <Box className={styles.metadataRow}>
                            {LibraryTagKeys.map(key => {
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
                        <ReactMarkdown
                            remarkPlugins={[remarkBreaks]}
                            rehypePlugins={[rehypeArticleEnrichment]}
                            components={markdownComponents}
                        >
                            {content}
                        </ReactMarkdown>
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
        </Box>
    );
}
