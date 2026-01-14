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
import LibraryBooksIcon from "@mui/icons-material/LibraryBooks";
import ReactMarkdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import { LibraryTagKeys, LibraryIcons } from "./Icons";
import { exportData } from "@util/importExport";
import { useToolbar, registerToolbar } from "@components/Toolbar";
import styles from "./Article.module.scss";
import clsx from "clsx";

registerToolbar("Article");

const rehypeArticleEnrichment = () => {
    return (tree) => {
        // Helper to get text content from a node
        const getText = (node) => {
            if (node.type === "text") return node.value;
            if (node.children) return node.children.map(getText).join("");
            return "";
        };

        // 1. Split <p> nodes that contain <br> into multiple <p> nodes
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

        // 2. Assign unique numbers to valid content paragraphs
        let index = 0;
        const visitAndNumber = (nodes) => {
            nodes.forEach(node => {
                if (node.type === "element" && node.tagName === "p") {
                    const textContent = getText(node).trim();
                    const metadataPatterns = [
                        /^author:/i,
                        /^book:/i,
                        /^article:/i,
                        /^year:/i,
                        /^volume:/i,
                        /^part:/i,
                        /^section:/i,
                        /^portion:/i,
                        /^chapter:/i,
                        /^title:/i,
                        /^====/
                    ];
                    const isMetadata = metadataPatterns.some(pattern => pattern.test(textContent)) ||
                        (textContent.length > 3 && textContent.replace(/=/g, "").length === 0);

                    if (!isMetadata && textContent.length > 0) {
                        index++;
                        node.properties = node.properties || {};
                        node.properties["data-p-index"] = index;
                    }
                }
                if (node.children) {
                    visitAndNumber(node.children);
                }
            });
        };

        if (tree.children) {
            visitAndNumber(tree.children);
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
    isHeaderShrunk,
    handleScroll,
    contentRef,
    handleDrawerToggle,
    showLibrarySideBar
}) {
    const [matchIndex, setMatchIndex] = useState(0);
    const [totalMatches, setTotalMatches] = useState(0);
    const [showPlaceholder, setShowPlaceholder] = useState(false);

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

    useEffect(() => {
        const highlights = document.querySelectorAll('.search-highlight');
        setTotalMatches(highlights.length);
        if (highlights.length > 0 && matchIndex >= highlights.length) {
            setMatchIndex(0);
        }
    }, [content, search]);

    const handleCopyText = useCallback((text) => {
        navigator.clipboard.writeText(String(text));
    }, []);

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
        const ParagraphNumber = ({ number }) => (
            <Typography
                onClick={(e) => {
                    e.stopPropagation();
                    handleCopyText(number);
                }}
                className={styles.paragraphNumber}
                sx={{ right: 0 }}
            >
                {number}
            </Typography>
        );

        return {
            p: ({ children, ...props }) => {
                const number = props["data-p-index"];
                if (!children || (Array.isArray(children) && children.length === 0)) return null;
                const childrenArray = React.Children.toArray(children);
                const hasContent = childrenArray.some(child => {
                    if (typeof child === "string") return child.trim().length > 0;
                    return true;
                });
                if (!hasContent) return null;

                return (
                    <Box className={styles.paragraphWrapper}>
                        <Box sx={{ flex: 1 }}>
                            <TextRenderer>{children}</TextRenderer>
                        </Box>
                        {number && <ParagraphNumber number={number} />}
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
    }, [handleCopyText, TextRenderer]);

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
                onClick: handleExport
            }
        ];
        if (isAdmin) {
            items.push({
                id: "edit",
                name: translations.EDIT_TAGS || "Edit Tags",
                icon: <EditIcon />,
                onClick: openEditDialog
            });
        }
        return items;
    }, [translations, handleCopy, handleExport, isAdmin, openEditDialog]);

    useToolbar({
        id: "Article",
        items: toolbarItems,
        visible: !!content,
        depends: [toolbarItems, content]
    });

    if (!content && showPlaceholder) {
        return (
            <Box className={styles.placeholder}>
                <LibraryBooksIcon sx={{ fontSize: 64, opacity: 0.5 }} />
                <Typography>{translations.SELECT_ITEM}</Typography>
            </Box>
        );
    }

    if (!content) {
        return null;
    }

    const title = selectedTag?.article || selectedTag?.chapter || selectedTag?.section;

    return (
        <Box
            component="main"
            ref={contentRef}
            onScroll={handleScroll}
            className={styles.root}
            minWidth={0}
            sx={{
                ml: { sm: showLibrarySideBar ? 2 : 0 }
            }}
        >
            <Box className={clsx(styles.stickyHeader, isHeaderShrunk && styles.shrunk)}>
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
                    <Box className={styles.headerTitleWrapper} sx={{ overflow: "hidden" }}>
                        <Box className={styles.titleRow} sx={{ overflow: "hidden" }}>
                            {selectedTag?.number && (
                                <Paper
                                    elevation={0}
                                    className={clsx(styles.tagNumber, isHeaderShrunk && styles.shrunk)}
                                >
                                    #{selectedTag.number}
                                </Paper>
                            )}
                            <Typography
                                variant={isHeaderShrunk ? "h6" : "h4"}
                                className={clsx(styles.title, isHeaderShrunk && styles.shrunk)}
                                sx={{ flex: 1 }}
                            >
                                {title}
                            </Typography>
                        </Box>
                        <Box
                            className={clsx(styles.metadataRow, isHeaderShrunk && styles.shrunk)}
                            sx={{
                                opacity: isHeaderShrunk ? 0 : 1,
                                maxHeight: isHeaderShrunk ? 0 : '500px',
                                marginTop: isHeaderShrunk ? 0 : '8px',
                                visibility: isHeaderShrunk ? 'hidden' : 'visible',
                                pointerEvents: isHeaderShrunk ? 'none' : 'auto',
                                transition: 'opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1), max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1), margin-top 0.3s cubic-bezier(0.4, 0, 0.2, 1), visibility 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                            }}
                        >
                            {LibraryTagKeys.map(key => {
                                if (!selectedTag?.[key] || key === "article" || key === "number") return null;
                                const value = selectedTag[key];
                                if (title === value) return null;
                                const Icon = LibraryIcons[key];
                                return (
                                    <Tooltip key={key} title={key.charAt(0).toUpperCase() + key.slice(1)} arrow>
                                        <Paper
                                            elevation={0}
                                            className={styles.metadataTag}
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
                    <ReactMarkdown
                        remarkPlugins={[remarkBreaks]}
                        rehypePlugins={[rehypeArticleEnrichment]}
                        components={markdownComponents}
                    >
                        {content}
                    </ReactMarkdown>
                </Box>
            </Box>
        </Box>
    );
}
