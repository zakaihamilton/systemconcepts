import React, { useMemo, useCallback, useState, useRef, useEffect } from "react";
import ReactDOM from 'react-dom';
import Box from "@mui/material/Box";
import ReactMarkdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import { glossary } from '@data/glossary';
import { termPattern, PHASE_COLORS, getStyleInfo } from "./GlossaryUtils";
import styles from './Markdown.module.scss';
import Zoom from "./Zoom";
import { LibraryStore } from "../Store";
import { setPath } from "@util/pages";
import { LibraryTagKeys } from "../Icons";

import Tooltip from "@mui/material/Tooltip";
import { useTranslations } from "@util/translations";
import clsx from "clsx";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";



const Term = ({ term, entry, search }) => {
    const translations = useTranslations();
    const [hover, setHover] = useState(false);
    const [tooltipStyle, setTooltipStyle] = useState({});
    const [bridgeStyle, setBridgeStyle] = useState({});
    const [placement, setPlacement] = useState('top');
    const containerRef = useRef(null);
    const tooltipRef = useRef(null);
    const hoverTimeoutRef = useRef(null);
    const [isMeasured, setIsMeasured] = useState(false);

    const styleInfo = getStyleInfo(entry.style);
    const phaseRaw = styleInfo?.phase;
    const phaseKey = typeof phaseRaw === 'string' ? phaseRaw.toLowerCase() : null;
    const phaseColor = phaseKey ? PHASE_COLORS[phaseKey] : null;
    const phaseLabel = phaseKey ? phaseKey.charAt(0).toUpperCase() + phaseKey.slice(1) : null;

    const handleMouseEnter = () => {
        hoverTimeoutRef.current = setTimeout(() => {
            setPlacement('top');
            setHover(true);
            setIsMeasured(false); // Reset measurement state
        }, 300); // 300ms delay
    };

    const handleMouseLeave = () => {
        if (hoverTimeoutRef.current) {
            clearTimeout(hoverTimeoutRef.current);
            hoverTimeoutRef.current = null;
        }
        setHover(false);
        setIsMeasured(false);
    };

    useEffect(() => {
        const handleScroll = () => {
            if (hover) {
                setHover(false);
                setIsMeasured(false);
                if (hoverTimeoutRef.current) {
                    clearTimeout(hoverTimeoutRef.current);
                }
            }
        };
        // Use capture: true to detect scroll events on parent containers
        window.addEventListener('scroll', handleScroll, { passive: true, capture: true });
        return () => window.removeEventListener('scroll', handleScroll, { capture: true });
    }, [hover]);

    // Layout effect to measure and position tooltip once it renders
    React.useLayoutEffect(() => {
        if (hover && tooltipRef.current && containerRef.current && !isMeasured) {
            const rect = containerRef.current.getBoundingClientRect();

            // Use offsetHeight to avoid transform scaling issues (animation)
            const tooltipHeight = tooltipRef.current.offsetHeight;
            const spaceTop = rect.top;

            const scrollX = window.scrollX;
            const scrollY = window.scrollY;

            // Base style for Portal (absolute relative to document)
            const baseStyle = {
                position: 'absolute',
                left: `${rect.left + scrollX + rect.width / 2}px`,
                zIndex: 1300,
                margin: 0,
                opacity: 0 // Keep invisible until positioned
            };

            const bridgeBase = {
                position: 'absolute',
                left: `${rect.left + scrollX}px`,
                width: `${rect.width}px`,
                transform: 'none',
                zIndex: 1299
            };

            let newTooltipStyle = {};
            let newBridgeStyle = {};

            // Logic: Prefer TOP if space permits, otherwise check BOTTOM
            // Or stick to original logic: if (spaceTop < 250) -> BOTTOM
            // New Logic: Check actual height against available space

            // Padding/Margin buffer
            const buffer = 20;

            // If there is not enough space on top for actual height, go bottom
            if (spaceTop < (tooltipHeight + buffer)) {
                // Place BOTTOM
                const topVal = rect.bottom + scrollY + 10;
                newTooltipStyle = {
                    ...baseStyle,
                    top: `${topVal}px`,
                    bottom: 'auto',
                    transform: 'translateX(-50%)', // Base transform for bottom
                    opacity: 1 // Make visible
                };
                newBridgeStyle = {
                    ...bridgeBase,
                    top: `${rect.bottom + scrollY}px`,
                    height: '10px'
                };
                setPlacement('bottom');
            } else {
                // Place TOP (Default preference)
                const topVal = rect.top + scrollY - 10;
                newTooltipStyle = {
                    ...baseStyle,
                    top: `${topVal}px`,
                    bottom: 'auto',
                    transform: 'translate(-50%, -100%)', // Base transform for top
                    opacity: 1 // Make visible
                };
                newBridgeStyle = {
                    ...bridgeBase,
                    top: `${rect.top + scrollY - 10}px`,
                    height: '10px'
                };
                setPlacement('top');
            }

            setTooltipStyle(newTooltipStyle);
            setBridgeStyle(newBridgeStyle);
            setIsMeasured(true);
        }
    }, [hover, isMeasured]);

    const mainText = entry.en || entry.trans || term;
    const showAnnotation = entry.trans && entry.trans.toLowerCase() !== mainText.toLowerCase();

    // Check for search match
    let isMatch = false;
    if (search) {
        const terms = Array.isArray(search) ? search : [search];
        isMatch = terms.some(termStr => {
            if (!termStr) return false;
            const lowerSearch = termStr.toLowerCase();
            return (
                term.toLowerCase().includes(lowerSearch) ||
                (entry.en && entry.en.toLowerCase().includes(lowerSearch)) ||
                (entry.trans && entry.trans.toLowerCase().includes(lowerSearch)) ||
                (entry.he && entry.he.includes(termStr))
            );
        });
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
                    {isMeasured && <div className={styles['glossary-bridge']} style={bridgeStyle} />}

                    <div
                        className={clsx(styles['glossary-tooltip'], styles[placement])}
                        style={isMeasured ? tooltipStyle : { opacity: 0, position: 'fixed', top: -9999, left: -9999 }}
                        ref={tooltipRef}
                    >
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

// Word-to-number mapping for chapter references
const wordToNumber = {
    'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
    'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
    'eleven': 11, 'twelve': 12, 'thirteen': 13, 'fourteen': 14, 'fifteen': 15,
    'sixteen': 16, 'seventeen': 17, 'eighteen': 18, 'nineteen': 19, 'twenty': 20,
    'first': 1, 'second': 2, 'third': 3, 'fourth': 4, 'fifth': 5,
    'sixth': 6, 'seventh': 7, 'eighth': 8, 'ninth': 9, 'tenth': 10
};

// Reference pattern to detect cross-references like "Inner Reflection Chapter Nine, item 33"
// Matches: [section name] Chapter [number/word], item [number]
// Reference pattern to detect cross-references like "Inner Reflection Chapter Nine, item 33"
// Matches: [Optional Section Name] Chapter [number/word], item [number]
const referencePattern = /(?:([A-Z][A-Za-z]+(?:\s+(?:[A-Z][A-Za-z]+|of|the|in|and))*)\s+)?Chapter\s+(\w+)(?:,?\s*item\s+(\d+))?/g;

// Find an article by partial tag matching
const findArticleByReference = (tags, sectionName, chapterName, currentTag) => {
    if (!tags || !Array.isArray(tags)) return null;

    // Clean up the section name (remove trailing " in" which might be captured)
    let cleanSection = sectionName ? sectionName.trim() : null;
    if (cleanSection && cleanSection.toLowerCase().endsWith(' in')) {
        cleanSection = cleanSection.slice(0, -3).trim();
    }

    const normalizedSection = cleanSection ? cleanSection.toLowerCase() : null;
    const normalizedChapter = chapterName ? chapterName.toLowerCase().trim() : '';

    // Convert word to number if applicable
    const chapterAsNumber = wordToNumber[normalizedChapter] || parseInt(normalizedChapter, 10);

    // Resolve section aliases from glossary
    const sectionAliases = [];
    if (normalizedSection) {
        sectionAliases.push(normalizedSection);
        const glossaryEntry = glossary[normalizedSection];
        if (glossaryEntry) {
            if (glossaryEntry.en) sectionAliases.push(glossaryEntry.en.toLowerCase());
            if (glossaryEntry.trans) sectionAliases.push(glossaryEntry.trans.toLowerCase());
        }
    } else if (currentTag?.section) {
        // Default to current section if not specified
        sectionAliases.push(currentTag.section.toLowerCase());
    }

    // Look for matching article
    return tags.find(tag => {
        // Book Constraint: Must be in the same book
        if (currentTag?.book && tag.book && tag.book !== currentTag.book) {
            return false;
        }

        // Check if section matches (partial match)
        const tagSection = (tag.section || '').toLowerCase();

        // Must have a section tag to match against
        if (!tagSection) return false;
        // Check match against any known alias of the section name
        const sectionMatch = sectionAliases.some(alias =>
            tagSection.includes(alias) || alias.includes(tagSection)
        );

        if (!sectionMatch) {
            return false;
        }

        // Check if chapter matches (word or number)
        const tagChapter = (tag.chapter || '').toLowerCase();

        // If the tag has no chapter, it cannot match a specific chapter request
        if (!tagChapter && normalizedChapter) {
            return false;
        }

        const tagChapterNumber = wordToNumber[tagChapter.replace(/chapter\s+/i, '').trim()] ||
            parseInt(tagChapter.replace(/\D/g, ''), 10);

        if (tagChapter.includes(normalizedChapter) ||
            (tagChapter && normalizedChapter.includes(tagChapter.replace(/chapter\s+/i, '').trim()))) {
            // Match same part if current tag has a part
            if (currentTag?.part && tag.part && tag.part !== currentTag.part) {
                return false;
            }
            return true;
        }

        if (!isNaN(chapterAsNumber) && !isNaN(tagChapterNumber) && chapterAsNumber === tagChapterNumber) {
            // Match same part if current tag has a part
            if (currentTag?.part && tag.part && tag.part !== currentTag.part) {
                return false;
            }
            return true;
        }

        return false;
    });
};

// Generate the navigation path for a tag
const getTagHierarchy = (tag) => {
    const hierarchy = LibraryTagKeys.map(key => tag[key]).map(v => v ? String(v).trim() : null).filter(Boolean);
    if (tag.number && hierarchy.length > 0) {
        hierarchy[hierarchy.length - 1] = `${hierarchy[hierarchy.length - 1]}:${tag.number}`;
    }
    return hierarchy;
};

// Component to render text with glossary terms (fully interactive)
const TextWithTerms = ({ text }) => {
    const parts = [];
    let lastIndex = 0;
    const matches = [...text.matchAll(termPattern)];

    for (const match of matches) {
        const term = match[0];
        let start = match.index;
        let end = start + term.length;

        const glossaryEntry = glossary[term.toLowerCase()];

        // Check for following parenthetical
        const textAfter = text.slice(end);
        const parentheticalMatch = /^\s*\(([^)]+)\)/.exec(textAfter);
        if (parentheticalMatch) {
            const content = parentheticalMatch[1].trim().toLowerCase();
            const mainText = (glossaryEntry?.en || glossaryEntry?.trans || term).toLowerCase();
            if (content === mainText || content === term.toLowerCase()) {
                end += parentheticalMatch[0].length;
            }
        }

        if (start > lastIndex) {
            parts.push(text.slice(lastIndex, start));
        }

        // Render fully interactive Term component
        parts.push(
            <span key={start}>
                <Term
                    term={term}
                    entry={glossaryEntry}
                />
            </span>
        );

        lastIndex = end;
    }

    if (lastIndex < text.length) {
        parts.push(text.slice(lastIndex));
    }

    return parts.length > 0 ? parts : text;
};

// ReferenceLink component for clickable cross-references
const ReferenceLink = ({ text, sectionName, chapterName, itemNumber, currentTag }) => {
    const translations = useTranslations();
    const tags = LibraryStore.useState(s => s.tags);

    const handleClick = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();

        const targetArticle = findArticleByReference(tags, sectionName, chapterName, currentTag);
        if (targetArticle) {
            const hierarchy = getTagHierarchy(targetArticle);
            if (hierarchy.length > 0) {
                if (itemNumber) {
                    // Update URL hash for deep linking
                    const lastIndex = hierarchy.length - 1;
                    const lastPart = hierarchy[lastIndex];
                    // Remove existing : suffix (or #/! if handling legacy)
                    const baseUrl = lastPart.split(/[:#!]/)[0];
                    hierarchy[lastIndex] = `${baseUrl}:${itemNumber}`;

                    // Also store in state for component-level handling
                    LibraryStore.update(s => {
                        s.scrollToParagraph = parseInt(itemNumber, 10);
                    });
                }
                setPath("library", ...hierarchy);
            }
        }
    }, [tags, sectionName, chapterName, itemNumber, currentTag]);

    const targetArticle = findArticleByReference(tags, sectionName, chapterName, currentTag);

    if (!targetArticle) {
        // No matching article found, render as plain text (with terms)
        return <TextWithTerms text={text} />;
    }

    // Build tooltip content from target article tags
    const tooltipContent = (
        <React.Fragment>
            <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>{translations?.NAVIGATE_TO || "Jump to:"}</div>
            {LibraryTagKeys.map(key => {
                if (!targetArticle[key] || key === "number" || key === "title") return null;
                return (
                    <div key={key}>
                        <span style={{ color: '#aaa' }}>{key.charAt(0).toUpperCase() + key.slice(1)}:</span> {targetArticle[key]}
                    </div>
                );
            })}
            {itemNumber && (
                <div>
                    <span style={{ color: '#aaa' }}>Item:</span> {itemNumber}
                </div>
            )}
        </React.Fragment>
    );

    return (
        <span className={styles['reference-container']}>
            <TextWithTerms text={text} />
            <Tooltip title={tooltipContent} arrow>
                <span
                    data-prevent-select="true"
                    onClick={handleClick}
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        verticalAlign: 'middle',
                        marginLeft: '6px',
                        marginTop: '-3px', // Make the arrow higher
                        cursor: 'pointer',
                        color: 'var(--primary-main)',
                        border: '1px solid var(--primary-main)',
                        borderRadius: '50%',
                        width: '18px',
                        height: '18px',
                        padding: '1px'
                    }}
                >
                    <ArrowForwardIcon style={{ fontSize: '0.9rem' }} />
                </span>
            </Tooltip>
        </span>
    );
};

ReferenceLink.displayName = "ReferenceLink";

const rehypeArticleEnrichment = () => {
    return (tree) => {
        let paragraphIndex = 0;
        const paragraphs = [];

        const visitAndSplit = (nodes) => {
            const newNodes = [];
            nodes.forEach(node => {
                if (node.type === "element" && (node.tagName === "p" || node.tagName === "pre" || node.tagName === "table" || node.tagName === "hr")) {
                    paragraphIndex++;
                    node.properties = { ...node.properties, dataParagraphIndex: paragraphIndex };
                    newNodes.push(node);
                    paragraphs.push(node);
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

        const totalParagraphs = paragraphIndex;
        paragraphs.forEach(node => {
            node.properties = { ...node.properties, dataTotalParagraphs: totalParagraphs };
        });
        // Optimization: We could attach totalParagraphs to root or context, 
        // but here we just loop again or assume component updates
    };
};


export default React.memo(function Markdown({ children, search, currentParagraphIndex, selectedTag, filteredParagraphs, disableGlossary }) {
    const translations = useTranslations();
    const [zoomedData, setZoomedData] = useState(null);

    const processedChildren = useMemo(() => {
        let content = children;
        if (Array.isArray(content)) {
            content = content.join('');
        }
        if (typeof content !== 'string') return content;

        // Convert Windows line endings
        content = content.replace(/\r\n/g, "\n");

        // Convert single newlines to double newlines (paragraph breaks)
        content = content.replace(/\n+/g, "\n\n");

        // Bold numbered lists (existing)
        content = content.replace(/^\s*(\d+)([\.\)])[ \t]*/gm, (match, number, symbol) => {
            return `\n\n**${number}\\${symbol}** `;
        });



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

        const terms = Array.isArray(search) ? search : [search];
        if (terms.length === 0) return children;

        const lowerChildren = children.toLowerCase();
        // Find all matches for all terms
        const matches = [];
        terms.forEach(term => {
            if (!term) return;
            const lowerTerm = term.toLowerCase();
            let index = lowerChildren.indexOf(lowerTerm);
            while (index !== -1) {
                matches.push({ start: index, end: index + term.length });
                index = lowerChildren.indexOf(lowerTerm, index + 1);
            }
        });

        if (matches.length === 0) return children;

        // Sort and merge overlapping matches
        matches.sort((a, b) => a.start - b.start);
        const merged = [];
        if (matches.length > 0) {
            let current = matches[0];
            for (let i = 1; i < matches.length; i++) {
                const next = matches[i];
                if (next.start < current.end) {
                    current.end = Math.max(current.end, next.end);
                } else {
                    merged.push(current);
                    current = next;
                }
            }
            merged.push(current);
        }

        const parts = [];
        let currentIndex = 0;

        merged.forEach(match => {
            if (match.start > currentIndex) {
                parts.push(children.slice(currentIndex, match.start));
            }
            parts.push(
                <span key={match.start} className={`${styles['search-highlight']} search-highlight`}>
                    {children.slice(match.start, match.end)}
                </span>
            );
            currentIndex = match.end;
        });

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
            // Fast path: skip expensive glossary/reference processing when disabled
            if (disableGlossary) {
                return <Highlight>{children}</Highlight>;
            }

            // Unconditional cleanup in renderer as final safety net
            let cleanChildren = children;
            cleanChildren = cleanChildren.replace(/\u00A0/g, ' ');
            cleanChildren = cleanChildren.replace(/\u200B/g, '');
            // Recursive comma collapse
            cleanChildren = cleanChildren.replace(/,[\s,]+,/g, ',');
            if (cleanChildren.match(/,[\s,]+,/)) {
                cleanChildren = cleanChildren.replace(/,[\s,]+,/g, ',');
            }

            // First pass: find all cross-references
            const references = [];
            const refMatches = [...cleanChildren.matchAll(referencePattern)];
            for (const refMatch of refMatches) {
                references.push({
                    text: refMatch[0],
                    sectionName: refMatch[1] ? refMatch[1].trim() : null,
                    chapterName: refMatch[2],
                    itemNumber: refMatch[3] || null,
                    start: refMatch.index,
                    end: refMatch.index + refMatch[0].length
                });
            }

            // Process text: split by references, then apply glossary to non-reference parts
            const processGlossary = (text, keyPrefix) => {
                const parts = [];
                let lastIndex = 0;
                const matches = [...text.matchAll(termPattern)];

                for (const match of matches) {
                    const term = match[0];
                    let start = match.index;
                    let end = start + term.length;

                    const glossaryEntry = glossary[term.toLowerCase()];

                    // Check for following parenthetical
                    const textAfter = text.slice(end);
                    const parentheticalMatch = /^\s*\(([^)]+)\)/.exec(textAfter);
                    if (parentheticalMatch) {
                        const content = parentheticalMatch[1].trim().toLowerCase();
                        const mainText = (glossaryEntry?.en || glossaryEntry?.trans || term).toLowerCase();
                        if (content === mainText || content === term.toLowerCase()) {
                            end += parentheticalMatch[0].length;
                        }
                    }

                    if (start > lastIndex) {
                        parts.push(
                            <Highlight key={`${keyPrefix}-text-${start}`}>
                                {text.slice(lastIndex, start)}
                            </Highlight>
                        );
                    }

                    // Skip lowercase 'or'
                    if (term === 'or') {
                        lastIndex = start;
                        continue;
                    }
                    // Skip 'Or' at the start of a sentence
                    if (term === 'Or') {
                        const isStartOfSentence = (start === 0) || /[\.!\?]\s+$/.test(text.slice(0, start));
                        if (isStartOfSentence) {
                            lastIndex = start;
                            continue;
                        }
                    }
                    parts.push(
                        <Term
                            key={`${keyPrefix}-gloss-${start}`}
                            term={term}
                            entry={glossaryEntry}
                            search={search}
                        />
                    );

                    lastIndex = end;
                }

                if (lastIndex < text.length) {
                    parts.push(
                        <Highlight key={`${keyPrefix}-text-end`}>
                            {text.slice(lastIndex)}
                        </Highlight>
                    );
                }

                return parts.length > 0 ? parts : <Highlight>{text}</Highlight>;
            };

            // If no references, just process glossary
            if (references.length === 0) {
                return processGlossary(cleanChildren, 'main');
            }

            // Build parts array with references and glossary-processed text
            const parts = [];
            let lastRefEnd = 0;

            references.forEach((ref, idx) => {
                // Add text before this reference (processed for glossary)
                if (ref.start > lastRefEnd) {
                    const beforeText = cleanChildren.slice(lastRefEnd, ref.start);
                    const glossaryParts = processGlossary(beforeText, `before-ref-${idx}`);
                    if (Array.isArray(glossaryParts)) {
                        parts.push(...glossaryParts);
                    } else {
                        parts.push(glossaryParts);
                    }
                }

                // Add the reference link
                parts.push(
                    <ReferenceLink
                        key={`ref-${idx}`}
                        text={ref.text}
                        sectionName={ref.sectionName}
                        chapterName={ref.chapterName}
                        itemNumber={ref.itemNumber}
                        currentTag={selectedTag}
                    />
                );

                lastRefEnd = ref.end;
            });

            // Add remaining text after last reference
            if (lastRefEnd < cleanChildren.length) {
                const afterText = cleanChildren.slice(lastRefEnd);
                const glossaryParts = processGlossary(afterText, 'after-ref');
                if (Array.isArray(glossaryParts)) {
                    parts.push(...glossaryParts);
                } else {
                    parts.push(glossaryParts);
                }
            }

            return parts;
        }

        return children;
    }, [Highlight, search, selectedTag, disableGlossary]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleParagraphZoom = useCallback((children, number) => {
        setZoomedData({ content: children, number });
    }, []);

    const markdownComponents = useMemo(() => {
        // Extract plain text from children for TTS
        const extractText = (child) => {
            if (typeof child === 'string') return child;
            if (Array.isArray(child)) return child.map(extractText).join('');
            if (React.isValidElement(child)) {
                const props = child.props;
                if (props?.className && typeof props.className === 'string' &&
                    props.className.includes('glossary-main-text')) {
                    return props.children || '';
                }
                if (props?.className && typeof props.className === 'string' &&
                    props.className.includes('glossary-annotation')) {
                    return '';
                }
                return extractText(props.children);
            }
            return '';
        };

        const getSpokenText = (text) => {
            if (!text) return text;
            return text.replace(termPattern, (match, capture, offset, string) => {
                // Skip lowercase 'or'
                if (match === 'or') {
                    return match;
                }
                // Skip 'Or' at the start of a sentence
                if (match === 'Or') {
                    const isStartOfSentence = (offset === 0) || /[\.\!\?]\s+$/.test(string.slice(0, offset));
                    if (isStartOfSentence) {
                        return match;
                    }
                }
                const lowerMatch = match.toLowerCase();
                const entry = glossary[lowerMatch];
                if (entry && entry.en) {
                    return entry.en;
                }
                return match;
            });
        };

        const HeaderRenderer = (tag) => {
            const Header = ({ node, children }) => {
                const paragraphIndex = node?.properties?.dataParagraphIndex;
                if (Array.isArray(filteredParagraphs) && !filteredParagraphs.includes(paragraphIndex)) return null;

                const currentIndex = Array.isArray(filteredParagraphs) ? filteredParagraphs.indexOf(paragraphIndex) : -1;
                const needsGap = currentIndex > 0 && (paragraphIndex - filteredParagraphs[currentIndex - 1] > 1);

                const rawText = extractText(children);
                const paragraphText = getSpokenText(rawText);
                const paragraphSelected = currentParagraphIndex === paragraphIndex;
                return (
                    <React.Fragment>
                        {needsGap && (
                            <Box className={styles.gapSeparator}>
                                •••
                            </Box>
                        )}
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
                            data-paragraph-text={paragraphText}
                        >
                            <TextRenderer>{children}</TextRenderer>
                        </Box>
                    </React.Fragment>
                );
            };
            Header.displayName = `Header${tag}`;
            return Header;
        };

        const ParagraphRenderer = ({ node, children }) => {
            const paragraphIndex = node?.properties?.dataParagraphIndex;
            const totalParagraphs = node?.properties?.dataTotalParagraphs;
            const isLastParagraph = paragraphIndex === totalParagraphs;

            if (Array.isArray(filteredParagraphs) && !filteredParagraphs.includes(paragraphIndex)) return null;
            if (!children || (Array.isArray(children) && children.length === 0)) return null;

            // Fast path for embedded/disableGlossary: skip expensive operations
            if (disableGlossary) {
                return (
                    <Box
                        className={styles.paragraph}
                        sx={{ marginBottom: '24px', lineHeight: 2.8 }}
                        data-paragraph-index={paragraphIndex}
                    >
                        <TextRenderer>{children}</TextRenderer>
                        <span className={styles.paragraphNumber}>
                            {paragraphIndex !== undefined ? paragraphIndex : ''}
                        </span>
                    </Box>
                );
            }

            // Full path: with hover state, tooltips, zoom, etc.
            const [hoveringNumber, setHoveringNumber] = useState(false);
            const rawText = extractText(children);
            const paragraphText = getSpokenText(rawText);
            const paragraphSelected = currentParagraphIndex === paragraphIndex;

            const currentIndex = Array.isArray(filteredParagraphs) ? filteredParagraphs.indexOf(paragraphIndex) : -1;
            const needsGap = currentIndex > 0 && (paragraphIndex - filteredParagraphs[currentIndex - 1] > 1);

            return (
                <React.Fragment>
                    {needsGap && (
                        <Box className={styles.gapSeparator}>
                            •••
                        </Box>
                    )}
                    <Box
                        className={`${styles.paragraph} ${paragraphSelected ? styles.selected : ''} ${hoveringNumber ? styles.suppressHover : ''}`}
                        sx={{ marginBottom: '24px', lineHeight: 2.8 }}
                        data-paragraph-index={paragraphIndex}
                        data-paragraph-text={paragraphText}
                    >
                        <TextRenderer>{children}</TextRenderer>
                        <Tooltip title={translations?.ZOOM} placement="top" arrow>
                            <span
                                data-prevent-select="true"
                                className={clsx(styles.paragraphNumber, paragraphSelected && styles.selected)}
                                onMouseEnter={() => setHoveringNumber(true)}
                                onMouseLeave={() => setHoveringNumber(false)}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    const number = node?.properties?.dataParagraphIndex;
                                    handleParagraphZoom(children, number);
                                }}
                            >
                                {paragraphIndex !== undefined ? paragraphIndex : ''}
                            </span>
                        </Tooltip>
                    </Box>
                    {isLastParagraph && (
                        <Box className={styles.endOfArticle}>
                            <Box className={styles.endOfArticleLine} />
                            <Box className={styles.endOfArticleOrnament}>✦</Box>
                            <Box className={styles.endOfArticleLine} />
                        </Box>
                    )}
                </React.Fragment>
            );
        };

        const BlockRenderer = (Tag) => {
            const Renderer = ({ node, children }) => {
                const paragraphIndex = node?.properties?.dataParagraphIndex;
                const span = node?.properties?.dataParagraphSpan || 1;

                if (Array.isArray(filteredParagraphs)) {
                    const isVisible = filteredParagraphs.some(p => p >= paragraphIndex && p < paragraphIndex + span);
                    if (!isVisible) return null;
                }

                return <Tag data-paragraph-index={paragraphIndex} data-paragraph-span={span}>{children}</Tag>;
            };
            Renderer.displayName = `BlockRenderer${Tag}`;
            return Renderer;
        };

        const VoidRenderer = (Tag) => {
            const Renderer = ({ node }) => {
                const paragraphIndex = node?.properties?.dataParagraphIndex;
                const span = node?.properties?.dataParagraphSpan || 1;

                if (Array.isArray(filteredParagraphs)) {
                    const isVisible = filteredParagraphs.some(p => p >= paragraphIndex && p < paragraphIndex + span);
                    if (!isVisible) return null;
                }

                return <Tag data-paragraph-index={paragraphIndex} data-paragraph-span={span} />;
            };
            Renderer.displayName = `VoidRenderer${Tag}`;
            return Renderer;
        };

        const fullComponents = {
            p: ParagraphRenderer,
            li: ({ children }) => <Box sx={{ mb: 1, lineHeight: 2.2, position: 'relative', backgroundColor: 'var(--background-paper)' }}><TextRenderer>{children}</TextRenderer></Box>,
            ul: BlockRenderer('ul'),
            ol: BlockRenderer('ol'),
            blockquote: BlockRenderer('blockquote'),
            pre: BlockRenderer('pre'),
            table: BlockRenderer('table'),
            hr: VoidRenderer('hr'),
            h1: HeaderRenderer('h1'),
            h2: HeaderRenderer('h2'),
            h3: HeaderRenderer('h3'),
            h4: HeaderRenderer('h4'),
            h5: HeaderRenderer('h5'),
            h6: HeaderRenderer('h6'),
            br: () => <span style={{ display: "block", marginBottom: "1.2rem" }} />
        };

        const embeddedComponents = {
            p: ParagraphRenderer,
            h1: HeaderRenderer('h1'),
            h2: HeaderRenderer('h2'),
            h3: HeaderRenderer('h3'),
            h4: HeaderRenderer('h4'),
            h5: HeaderRenderer('h5'),
            h6: HeaderRenderer('h6'),
        };

        return { full: fullComponents, embedded: embeddedComponents };
    }, [currentParagraphIndex, filteredParagraphs, translations, TextRenderer, handleParagraphZoom]); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <>
            <div className={styles.container}>
                <ReactMarkdown
                    remarkPlugins={[remarkBreaks]}
                    rehypePlugins={[rehypeArticleEnrichment]}
                    components={disableGlossary ? markdownComponents.embedded : markdownComponents.full}
                >
                    {processedChildren}
                </ReactMarkdown>
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