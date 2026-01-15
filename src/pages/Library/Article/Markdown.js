import React, { useMemo, useCallback } from "react";
import Box from "@mui/material/Box";
import ReactMarkdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';

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

export default function Markdown({ children, search }) {
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
            ol: ({ start, children, ...props }) => {
                const startIndex = parseInt(start, 10) || 1;
                return (
                    <Box component="ol" sx={{ listStyle: "none", m: 0, p: 0, pl: 3 }} {...props}>
                        {React.Children.map(children, (child, i) => {
                            if (React.isValidElement(child)) {
                                return React.cloneElement(child, { index: startIndex + i, ordered: true });
                            }
                            return child;
                        })}
                    </Box>
                );
            },
            ul: ({ children, ...props }) => (
                <Box component="ul" sx={{ listStyle: "none", m: 0, p: 0, pl: 3 }} {...props}>
                    {React.Children.map(children, (child) => {
                        if (React.isValidElement(child)) {
                            return React.cloneElement(child, { ordered: false });
                        }
                        return child;
                    })}
                </Box>
            ),
            li: ({ children, index, ordered, ...props }) => {
                const marker = ordered ? (
                    <Box component="span" sx={{ minWidth: "1.5em", mr: 1, textAlign: "right", userSelect: "text" }}>
                        {index}.
                    </Box>
                ) : (
                    <Box component="span" sx={{ minWidth: "1em", mr: 1, textAlign: "center", userSelect: "text" }}>
                        •
                    </Box>
                );

                return (
                    <Box component="li" sx={{ mb: 1, display: "flex", alignItems: "baseline" }} {...props}>
                        {marker}
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                            <TextRenderer>{children}</TextRenderer>
                        </Box>
                    </Box>
                );
            },
            h1: ({ children }) => <h1><TextRenderer>{children}</TextRenderer></h1>,
            h2: ({ children }) => <h2><TextRenderer>{children}</TextRenderer></h2>,
            h3: ({ children }) => <h3><TextRenderer>{children}</TextRenderer></h3>,
            h4: ({ children }) => <h4><TextRenderer>{children}</TextRenderer></h4>,
            h5: ({ children }) => <h5><TextRenderer>{children}</TextRenderer></h5>,
            h6: ({ children }) => <h6><TextRenderer>{children}</TextRenderer></h6>,
            br: () => <span style={{ display: "block", marginBottom: "1.2rem", content: '""' }} />
        };
    }, [TextRenderer]);

    return (
        <ReactMarkdown
            remarkPlugins={[remarkBreaks]}
            rehypePlugins={[rehypeArticleEnrichment]}
            components={markdownComponents}
        >
            {children}
        </ReactMarkdown>
    );
}
