import React, { useMemo, useCallback, useState, useRef, useEffect } from "react";
import ReactDOM from 'react-dom';
import Box from "@mui/material/Box";
import ReactMarkdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import { glossary } from './Glossary';
import styles from './Markdown.module.scss'; // Import as Module
import ZoomDialog from "./ZoomDialog";

const Term = ({ term, entry, search }) => {
    const [hover, setHover] = useState(false);
    const [tooltipStyle, setTooltipStyle] = useState({});
    const [bridgeStyle, setBridgeStyle] = useState({});
    const containerRef = useRef(null);
    const hoverTimeoutRef = useRef(null);

    const handleMouseEnter = () => {
        hoverTimeoutRef.current = setTimeout(() => {
            if (containerRef.current) {
                const rect = containerRef.current.getBoundingClientRect();
                const spaceTop = rect.top;

                const scrollX = window.scrollX;
                const scrollY = window.scrollY;

                // Base style for Portal (absolute relative to document)
                const baseStyle = {
                    position: 'absolute',
                    left: `${rect.left + scrollX + rect.width / 2}px`,
                    zIndex: 1300,
                    margin: 0
                };

                const bridgeBase = {
                    position: 'absolute',
                    left: `${rect.left + scrollX}px`,
                    width: `${rect.width}px`,
                    transform: 'none',
                    zIndex: 1299
                };

                if (spaceTop < 250) {
                    // Place BOTTOM
                    const topVal = rect.bottom + scrollY + 10;
                    setTooltipStyle({
                        ...baseStyle,
                        top: `${topVal}px`,
                        bottom: 'auto',
                        transform: 'translateX(-50%)'
                    });
                    setBridgeStyle({
                        ...bridgeBase,
                        top: `${rect.bottom + scrollY}px`,
                        height: '10px'
                    });
                } else {
                    // Place TOP
                    const topVal = rect.top + scrollY - 10;
                    setTooltipStyle({
                        ...baseStyle,
                        top: `${topVal}px`,
                        bottom: 'auto',
                        // Use translate to shift it UP from the anchor point
                        transform: 'translate(-50%, -100%)'
                    });
                    setBridgeStyle({
                        ...bridgeBase,
                        top: `${rect.top + scrollY - 10}px`,
                        height: '10px'
                    });
                }
            }
            setHover(true);
        }, 300); // 300ms delay
    };

    const handleMouseLeave = () => {
        if (hoverTimeoutRef.current) {
            clearTimeout(hoverTimeoutRef.current);
            hoverTimeoutRef.current = null;
        }
        setHover(false);
    };

    useEffect(() => {
        const handleScroll = () => {
            if (hover) {
                setHover(false);
                if (hoverTimeoutRef.current) {
                    clearTimeout(hoverTimeoutRef.current);
                }
            }
        };
        // Use capture: true to detect scroll events on parent containers
        window.addEventListener('scroll', handleScroll, { passive: true, capture: true });
        return () => window.removeEventListener('scroll', handleScroll, { capture: true });
    }, [hover]);

    const mainText = entry.en || entry.trans || term;
    const showAnnotation = entry.trans && entry.trans.toLowerCase() !== mainText.toLowerCase();

    // Check for search match
    let isMatch = false;
    if (search) {
        const lowerSearch = search.toLowerCase();
        isMatch = (
            term.toLowerCase().includes(lowerSearch) ||
            (entry.en && entry.en.toLowerCase().includes(lowerSearch)) ||
            (entry.trans && entry.trans.toLowerCase().includes(lowerSearch)) ||
            (entry.he && entry.he.includes(search))
        );
    }

    // Combine classes: locally scoped style + global 'search-highlight' for Article.js to find
    const mainTextClass = `${styles['glossary-main-text']} ${isMatch ? 'search-highlight' : ''}`;

    return (
        <span
            className={styles['glossary-term-container']}
            ref={containerRef}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            {/* The Transliteration (Top Annotation) */}
            {showAnnotation && <span className={styles['glossary-annotation']}>{entry.trans}</span>}

            {/* The Main Text (English Translation) */}
            <span className={mainTextClass}>{mainText}</span>

            {/* The Tooltip (Portalled) */}
            {hover && ReactDOM.createPortal(
                <>
                    {/* Bridge ensures connection between word and tooltip */}
                    <div className={styles['glossary-bridge']} style={bridgeStyle} />

                    <div className={styles['glossary-tooltip']} style={tooltipStyle}>
                        {/* English Section */}
                        <div className={styles['tt-label']}>Translation</div>
                        <div className={styles['tt-value']}>{entry.en || mainText}</div>

                        <hr />

                        {/* Transliteration Section */}
                        <div className={styles['tt-label']}>Transliteration</div>
                        <div className={styles['tt-value']}>{entry.trans}</div>

                        <hr />

                        {/* Hebrew Section */}
                        <div className={styles['tt-label']}>Hebrew</div>
                        <div className={styles['tt-hebrew']}>{entry.he}</div>
                    </div>
                </>,
                document.body
            )}
        </span>
    );
};

const rehypeArticleEnrichment = () => {
    return (tree) => {
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
                    if (currentSegment.length > 0) segments.push(currentSegment);

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

// Create the regex once since glossary is constant
const termPattern = new RegExp(`\\b(${Object.keys(glossary).join('|')})\\b`, 'gi');

export default React.memo(function Markdown({ children, search }) {
    const [zoomedContent, setZoomedContent] = useState(null);

    const processedChildren = useMemo(() => {
        if (typeof children !== 'string') return children;
        return children.replace(/^\s*(\d+)([\.\)])\s*/gm, (match, number, symbol) => {
            return `**${number}\\${symbol}** `;
        });
    }, [children]);

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
                <span key={matchIndexPos} className={`${styles['search-highlight']} search-highlight`}>
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

        if (React.isValidElement(children)) {
            return React.cloneElement(children, {
                children: <TextRenderer>{children.props.children}</TextRenderer>
            });
        }

        if (typeof children === 'string') {
            const parts = [];
            let lastIndex = 0;
            let match;

            // Reset lastIndex for the global regex because we are reusing it
            termPattern.lastIndex = 0;

            while ((match = termPattern.exec(children)) !== null) {
                const term = match[0];
                const start = match.index;
                const end = start + term.length;

                if (start > lastIndex) {
                    parts.push(
                        <Highlight key={`text-${start}`}>
                            {children.slice(lastIndex, start)}
                        </Highlight>
                    );
                }

                const glossaryEntry = glossary[term.toLowerCase()];
                // Skip lowercase 'or'
                if (term === 'or') {
                    continue;
                }
                // Skip 'Or' at the start of a sentence (sentence terminator + whitespace before it, or start of block)
                if (term === 'Or') {
                    const isStartOfSentence = (start === 0) || /[\.\!\?]\s+$/.test(children.slice(0, start));
                    if (isStartOfSentence) {
                        continue;
                    }
                }
                parts.push(
                    <Term
                        key={`gloss-${start}`}
                        term={term}
                        entry={glossaryEntry}
                        search={search}
                    />
                );

                lastIndex = end;
            }

            if (lastIndex < children.length) {
                parts.push(
                    <Highlight key={`text-end`}>
                        {children.slice(lastIndex)}
                    </Highlight>
                );
            }

            return parts.length > 0 ? parts : <Highlight>{children}</Highlight>;
        }

        return children;
    }, [Highlight]);

    const handleParagraphDoubleClick = useCallback((children) => {
        setZoomedContent(children);
    }, []);

    const markdownComponents = useMemo(() => {
        return {
            p: ({ children }) => {
                const lastTap = useRef(0);
                const handleTouchEnd = (e) => {
                    const now = Date.now();
                    if (now - lastTap.current < 300) {
                        e.preventDefault();
                        handleParagraphDoubleClick(children);
                    }
                    lastTap.current = now;
                };

                if (!children || (Array.isArray(children) && children.length === 0)) return null;
                return (
                    <Box
                        className={styles.paragraph}
                        sx={{ marginBottom: '24px', lineHeight: 2.8 }}
                        onDoubleClick={() => handleParagraphDoubleClick(children)}
                        onTouchEnd={handleTouchEnd}
                        style={{ touchAction: 'manipulation' }}
                    >
                        <TextRenderer>{children}</TextRenderer>
                    </Box>
                );
            },
            li: ({ children }) => <Box sx={{ mb: 1, lineHeight: 2.2 }}><TextRenderer>{children}</TextRenderer></Box>,
            h1: ({ children }) => <Box component="h1" sx={{ mt: 3, mb: 2 }}><TextRenderer>{children}</TextRenderer></Box>,
            br: () => <span style={{ display: "block", marginBottom: "1.2rem" }} />
        };
    }, [TextRenderer, handleParagraphDoubleClick]);

    return (
        <>
            <ReactMarkdown
                remarkPlugins={[remarkBreaks]}
                rehypePlugins={[rehypeArticleEnrichment]}
                components={markdownComponents}
            >
                {processedChildren}
            </ReactMarkdown>

            <ZoomDialog
                open={!!zoomedContent}
                onClose={() => setZoomedContent(null)}
                content={zoomedContent}
                Renderer={TextRenderer}
            />
        </>
    );
});