import React, { useMemo, useCallback, useState, useRef } from "react";
import Box from "@mui/material/Box";
import ReactMarkdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import { glossary } from './Glossary';
import styles from './Markdown.module.scss'; // Import as Module

const Term = ({ term, entry }) => {
    const [hover, setHover] = useState(false);
    const [placement, setPlacement] = useState('top');
    const containerRef = useRef(null);

    const handleMouseEnter = () => {
        if (containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            // If the element is within 250px of the top of the viewport, flip to bottom
            const spaceTop = rect.top;
            if (spaceTop < 250) {
                setPlacement('bottom');
            } else {
                setPlacement('top');
            }
        }
        setHover(true);
    };

    const mainText = entry.en || entry.trans || term;
    const showAnnotation = entry.trans && entry.trans.toLowerCase() !== mainText.toLowerCase();

    return (
        <span
            className={styles['glossary-term-container']}
            ref={containerRef}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={() => setHover(false)}
        >
            {/* The Transliteration (Top Annotation) */}
            {showAnnotation && <span className={styles['glossary-annotation']}>{entry.trans}</span>}

            {/* The Main Text (English Translation) */}
            <span className={styles['glossary-main-text']}>{mainText}</span>

            {/* The Tooltip */}
            {hover && (
                <>
                    {/* Bridge ensures connection between word and tooltip */}
                    <div className={`${styles['glossary-bridge']} ${styles[placement]}`} />

                    <div className={`${styles['glossary-tooltip']} ${styles[placement]}`}>
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
                </>
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

export default function Markdown({ children, search }) {
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
            const glossaryKeys = Object.keys(glossary);
            const pattern = new RegExp(`\\b(${glossaryKeys.join('|')})\\b`, 'gi');

            const parts = [];
            let lastIndex = 0;
            let match;

            while ((match = pattern.exec(children)) !== null) {
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

    const markdownComponents = useMemo(() => {
        return {
            p: ({ children }) => {
                if (!children || (Array.isArray(children) && children.length === 0)) return null;
                return (
                    <Box sx={{ marginBottom: '24px', lineHeight: 2.8 }}>
                        <TextRenderer>{children}</TextRenderer>
                    </Box>
                );
            },
            li: ({ children }) => <Box sx={{ mb: 1, lineHeight: 2.2 }}><TextRenderer>{children}</TextRenderer></Box>,
            h1: ({ children }) => <Box component="h1" sx={{ mt: 3, mb: 2 }}><TextRenderer>{children}</TextRenderer></Box>,
            br: () => <span style={{ display: "block", marginBottom: "1.2rem" }} />
        };
    }, [TextRenderer]);

    return (
        <ReactMarkdown
            remarkPlugins={[remarkBreaks]}
            rehypePlugins={[rehypeArticleEnrichment]}
            components={markdownComponents}
        >
            {processedChildren}
        </ReactMarkdown>
    );
}