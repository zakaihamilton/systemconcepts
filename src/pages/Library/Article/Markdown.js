import React, { useMemo, useCallback } from "react";
import Box from "@mui/material/Box";
import ReactMarkdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';

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

        return children
            // REGEX EXPLANATION:
            // ^\s* : Start of line + optional spaces
            // (\d+)      : Capture the number (Group 1)
            // ([\.\)])   : Capture either a dot OR a parenthesis (Group 2)
            // \s* : Optional trailing spaces
            .replace(/^\s*(\d+)([\.\)])\s*/gm, (match, number, symbol) => {
                // If it was "17)", it becomes "**17\)** "
                // If it was "1.", it becomes "**1\.** "
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
        if (typeof children === 'string') return <Highlight>{children}</Highlight>;
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
                return (
                    <Box sx={{ marginBottom: '16px', lineHeight: 1.7 }}>
                        <TextRenderer>{children}</TextRenderer>
                    </Box>
                );
            },
            // We disable standard list rendering for these numbered items to prevent double-indenting
            li: ({ children }) => <Box sx={{ mb: 1 }}><TextRenderer>{children}</TextRenderer></Box>,
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