import React, { useMemo, useCallback, useState, useRef, useEffect } from "react";
import ReactDOM from 'react-dom';
import Box from "@mui/material/Box";
import ReactMarkdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import { glossary } from '@data/glossary';
import { termPattern, PHASE_COLORS, getStyleInfo } from "./GlossaryUtils";
import styles from './Markdown.module.scss';
import Zoom from "./Zoom";


import Tooltip from "@mui/material/Tooltip";
import { useTranslations } from "@util/translations";
import clsx from "clsx";



const Term = ({ term, entry, search }) => {
    const translations = useTranslations();
    const [hover, setHover] = useState(false);
    const [tooltipStyle, setTooltipStyle] = useState({});
    const [bridgeStyle, setBridgeStyle] = useState({});
    const containerRef = useRef(null);
    const hoverTimeoutRef = useRef(null);

    const styleInfo = getStyleInfo(entry.style);
    const phaseRaw = styleInfo?.phase;
    const phaseKey = typeof phaseRaw === 'string' ? phaseRaw.toLowerCase() : null;
    const phaseColor = phaseKey ? PHASE_COLORS[phaseKey] : null;
    const phaseLabel = phaseKey ? phaseKey.charAt(0).toUpperCase() + phaseKey.slice(1) : null;

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
            <span
                className={mainTextClass}
                style={phaseColor ? { borderBottom: `2px solid ${phaseColor}` } : {}}
            >
                {mainText}
            </span>

            {/* The Tooltip (Portalled) */}
            {hover && ReactDOM.createPortal(
                <>
                    {/* Bridge ensures connection between word and tooltip */}
                    <div className={styles['glossary-bridge']} style={bridgeStyle} />

                    <div className={styles['glossary-tooltip']} style={tooltipStyle}>
                        {styleInfo?.category && (
                            <div className={styles['tt-category']} style={{
                                display: 'inline-block',
                                background: '#eee',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                fontSize: '0.7rem',
                                marginBottom: '8px',
                                color: '#333'
                            }}>
                                {styleInfo.category}
                            </div>
                        )}
                        {phaseLabel && (
                            <div className={styles['tt-phase']} style={{
                                display: 'inline-block',
                                background: phaseColor,
                                color: '#000',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                fontSize: '0.7rem',
                                marginBottom: '8px',
                                marginLeft: '6px',
                                border: '1px solid rgba(0,0,0,0.1)'
                            }}>
                                {phaseLabel}
                            </div>
                        )}
                        {/* English Section */}
                        <div className={styles['tt-label']}>{translations.TRANSLATION}</div>
                        <div className={styles['tt-value']}>{entry.en || mainText}</div>

                        <hr />

                        {/* Transliteration Section */}
                        <div className={styles['tt-label']}>{translations.TRANSLITERATION}</div>
                        <div className={styles['tt-value']}>{entry.trans}</div>

                        {!!entry.he && (
                            <>
                                <hr />
                                <div className={styles['tt-label']}>{translations.HEBREW}</div>
                                <div className={styles['tt-hebrew']}>{entry.he}</div>
                            </>
                        )}
                    </div>
                </>,
                document.body
            )}
        </span>
    );
};

Term.displayName = "Term";

const rehypeArticleEnrichment = () => {
    return (tree) => {
        let paragraphIndex = 0;
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
                        paragraphIndex++;
                        node.properties = { ...node.properties, dataParagraphIndex: paragraphIndex };
                        newNodes.push(node);
                    } else {
                        segments.forEach(seg => {
                            paragraphIndex++;
                            newNodes.push({
                                type: "element",
                                tagName: "p",
                                properties: { ...node.properties, dataParagraphIndex: paragraphIndex },
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


export default React.memo(function Markdown({ children, search, currentTTSParagraph }) {
    const translations = useTranslations();
    const [zoomedData, setZoomedData] = useState(null);

    const processedChildren = useMemo(() => {
        let content = children;
        if (Array.isArray(content)) {
            content = content.join('');
        }
        if (typeof content !== 'string') return content;

        // Bold numbered lists (existing)
        content = content.replace(/^\s*(\d+)([\.\)])\s*/gm, (match, number, symbol) => {
            return `**${number}\\${symbol}** `;
        });

        // Remove duplicate newlines (normalize to a single newline for paragraph breaks)
        content = content.replace(/\n{2,}/g, '\n');

        // Detect headings
        // Heuristic: Start of line, Uppercase, No period/semicolon/comma at end, < 80 chars
        // Also check: if next line starts with lowercase, this line is a continuation, not a header
        // Negative lookahead to ensure not already a header or list item, or number
        content = content.replace(/^[ \t]*(?!#|-|\*|\d)([A-Z].*?)[ \t]*(\r?\n)/gm, (match, line, newline) => {
            // Check if it really looks like a header
            const trimmed = line.trim();
            if (!trimmed) return match;
            if (trimmed.endsWith('.')) return match; // Sentence ending with period
            if (trimmed.endsWith(';')) return match; // Sentence ending with semicolon
            if (trimmed.endsWith(',')) return match; // Sentence ending with comma
            if (trimmed.length > 120) return match; // Too long

            // Check what follows this line - look ahead in original content
            const matchEnd = match.length;
            const afterMatch = content.slice(content.indexOf(match) + matchEnd);
            const nextLineMatch = afterMatch.match(/^[ \t]*(\S)/);
            if (nextLineMatch) {
                const firstChar = nextLineMatch[1];
                // If next non-empty line starts with lowercase, this is a continuation
                if (/[a-z]/.test(firstChar)) return match;
            }

            // It passes heuristic, make it a header
            return `### ${trimmed}${newline}`;
        });

        // Cleanup double commas (handles ", ," and ",," and ",   ," and " ,")
        // Aggressive: Replace any sequence starting and ending with comma, containing only commas/spaces, with single comma
        content = content.replace(/\u00A0/g, ' '); // Replace NBSP with space
        content = content.replace(/\u200B/g, ''); // Remove Zero Width Space
        content = content.replace(/ ,/g, ',');
        content = content.replace(/,[\s,]+,/g, ',');

        // Fallback for tricky overlaps
        if (content.match(/,[\s,]+,/)) {
            content = content.replace(/,[\s,]+,/g, ',');
        }

        return content;
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
            // Unconditional cleanup in renderer as final safety net
            let cleanChildren = children;
            cleanChildren = cleanChildren.replace(/\u00A0/g, ' ');
            cleanChildren = cleanChildren.replace(/\u200B/g, '');
            // Recursive comma collapse
            cleanChildren = cleanChildren.replace(/,[\s,]+,/g, ',');
            if (cleanChildren.match(/,[\s,]+,/)) {
                cleanChildren = cleanChildren.replace(/,[\s,]+,/g, ',');
            }

            const parts = [];
            let lastIndex = 0;
            let match;

            // Reset lastIndex for the global regex because we are reusing it
            termPattern.lastIndex = 0;

            while ((match = termPattern.exec(cleanChildren)) !== null) {
                const term = match[0];
                let start = match.index;
                let end = start + term.length;

                const glossaryEntry = glossary[term.toLowerCase()];

                // Check for following parenthetical that matches the term translation
                // This handles cases like "Head (head)" or "Term (Translated Term)"
                const textAfter = cleanChildren.slice(end);
                // Look for (content)
                const parentheticalMatch = /^\s*\(([^)]+)\)/.exec(textAfter);
                if (parentheticalMatch) {
                    const content = parentheticalMatch[1].trim().toLowerCase();
                    const mainText = (glossaryEntry?.en || glossaryEntry?.trans || term).toLowerCase();

                    // If the parenthetical content roughly matches the translation/term
                    if (content === mainText || content === term.toLowerCase()) {
                        // Consume the parenthetical
                        end += parentheticalMatch[0].length;
                    }
                }

                if (start > lastIndex) {
                    parts.push(
                        <Highlight key={`text-${start}`}>
                            {cleanChildren.slice(lastIndex, start)}
                        </Highlight>
                    );
                }

                // Skip lowercase 'or'
                if (term === 'or') {
                    lastIndex = start;
                    continue;
                }
                // Skip 'Or' at the start of a sentence (sentence terminator + whitespace before it, or start of block)
                if (term === 'Or') {
                    const isStartOfSentence = (start === 0) || /[\.\!\?]\s+$/.test(cleanChildren.slice(0, start));
                    if (isStartOfSentence) {
                        lastIndex = start;
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

            if (lastIndex < cleanChildren.length) {
                parts.push(
                    <Highlight key={`text-end`}>
                        {cleanChildren.slice(lastIndex)}
                    </Highlight>
                );
            }

            return parts.length > 0 ? parts : <Highlight>{cleanChildren}</Highlight>;
        }

        return children;
    }, [Highlight, search]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleParagraphZoom = useCallback((children, number) => {
        setZoomedData({ content: children, number });
    }, []);

    const markdownComponents = useMemo(() => {
        const HeaderRenderer = (tag) => {
            const Header = ({ node, children }) => {
                const paragraphIndex = node?.properties?.dataParagraphIndex;
                const paragraphSelected = currentTTSParagraph === paragraphIndex;
                return (
                    <Box
                        component={tag}
                        className={paragraphSelected ? styles.selected : ''}
                        sx={{
                            mt: 3,
                            mb: 2,
                            fontWeight: 'bold',
                            position: 'relative',
                            backgroundColor: 'var(--background-paper)',
                            padding: '16px 16px',
                            borderRadius: '8px'
                        }}
                        data-paragraph-index={paragraphIndex}
                    >
                        <TextRenderer>{children}</TextRenderer>
                    </Box>
                );
            };
            Header.displayName = `Header${tag}`;
            return Header;
        };

        return {
            p: ({ node, children }) => {
                if (!children || (Array.isArray(children) && children.length === 0)) return null;

                // Extract plain text from children for TTS
                const extractText = (child) => {
                    if (typeof child === 'string') return child;
                    if (Array.isArray(child)) return child.map(extractText).join('');
                    if (React.isValidElement(child)) {
                        // Check if this is a glossary term by looking for the Term component structure
                        // The Term component renders: <span with glossary-main-text class>
                        // We want to extract the main text (translation) not the original term
                        const props = child.props;

                        // If it's a span with className containing 'glossary-main-text', get its text content
                        if (props?.className && typeof props.className === 'string' &&
                            props.className.includes('glossary-main-text')) {
                            return props.children || '';
                        }

                        // Skip glossary annotations (transliteration above the word)
                        if (props?.className && typeof props.className === 'string' &&
                            props.className.includes('glossary-annotation')) {
                            return '';
                        }

                        return extractText(props.children);
                    }
                    return '';
                };

                const paragraphText = extractText(children);
                const paragraphIndex = node?.properties?.dataParagraphIndex;
                const paragraphSelected = currentTTSParagraph === paragraphIndex;

                return (
                    <Box
                        className={`${styles.paragraph} ${paragraphSelected ? styles.selected : ''}`}
                        sx={{ marginBottom: '24px', lineHeight: 2.8 }}
                        data-paragraph-index={paragraphIndex}
                        data-paragraph-text={paragraphText}
                    >
                        <TextRenderer>{children}</TextRenderer>
                        <Tooltip title={translations?.ZOOM} placement="top" arrow>
                            <span
                                className={clsx(styles.paragraphNumber, paragraphSelected && styles.selected)}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    const number = node?.properties?.dataParagraphIndex;
                                    handleParagraphZoom(children, number);
                                }}
                            />
                        </Tooltip>
                    </Box>
                );
            },
            li: ({ children }) => <Box sx={{ mb: 1, lineHeight: 2.2, position: 'relative', backgroundColor: 'var(--background-paper)' }}><TextRenderer>{children}</TextRenderer></Box>,
            h1: HeaderRenderer('h1'),
            h2: HeaderRenderer('h2'),
            h3: HeaderRenderer('h3'),
            h4: HeaderRenderer('h4'),
            h5: HeaderRenderer('h5'),
            h6: HeaderRenderer('h6'),
            br: () => <span style={{ display: "block", marginBottom: "1.2rem" }} />
        };
    }, [TextRenderer, handleParagraphZoom, currentTTSParagraph, translations]); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <>
            <div className={styles.container}>
                <ReactMarkdown
                    remarkPlugins={[remarkBreaks]}
                    rehypePlugins={[rehypeArticleEnrichment]}
                    components={markdownComponents}
                >
                    {processedChildren}
                </ReactMarkdown>
                <Box className={styles.endOfArticle}>
                    <Box className={styles.endOfArticleLine} />
                    <Box className={styles.endOfArticleOrnament}>✦</Box>
                    <Box className={styles.endOfArticleLine} />
                </Box>
            </div>

            <Zoom
                open={!!zoomedData}
                onClose={() => setZoomedData(null)}
                content={zoomedData?.content}
                number={zoomedData?.number}
                badgeClass={styles.paragraphBadge}
                Renderer={TextRenderer}
                copyExcludeSelectors={[`.${styles['glossary-annotation']}`]}
            />
        </>
    );
});