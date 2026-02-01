import React, { useRef, useEffect, useMemo } from "react";
import styles from "./SearchResultItem.module.scss";
import Article from "@pages/Library/Article";
import { normalizeContent, preprocessMarkdown } from "@util/string";

const SearchResultItem = ({ index, style, data }) => {
    const { results, gotoArticle, setRowHeight, highlight } = data || {};
    const doc = results ? results[index] : null;
    const rowRef = useRef(null);

    useEffect(() => {
        if (rowRef.current && setRowHeight) {
            const observer = new ResizeObserver((entries) => {
                for (let entry of entries) {
                    const rect = entry.target.getBoundingClientRect();
                    const height = rect.height;
                    if (height > 0) {
                        setRowHeight(index, height + 4);
                    }
                }
            });
            observer.observe(rowRef.current);
            return () => observer.disconnect();
        }
    }, [index, setRowHeight, doc?.docId]);

    // Transform text: use shared normalization to match indexing
    const content = useMemo(() => {
        if (doc?.text) return normalizeContent(doc.text);
        if (doc?.paragraphs) {
            let paragraphs = doc.paragraphs;
            // For sessions, exclude the title (index 0) so numbering starts at 1 for the summary
            if (doc.isSession && paragraphs.length > 0) {
                paragraphs = paragraphs.slice(1);
            }
            let text = paragraphs.join("\n\n");

            // Fix formatting for session summaries: ensure numbered lists start on new lines
            if (doc.isSession) {
                text = preprocessMarkdown(text);
            }
            return text;
        }
        return "";
    }, [doc]);
    // filteredParagraphs: 1-based indices of matches (adjusted for title removal in sessions)
    const filteredParagraphs = useMemo(() => {
        if (!doc?.matches) return [];
        // For sessions, we sliced off the title (index 0), so adjust indices by -1
        if (doc.isSession) {
            return doc.matches.map(m => m.index); // m.index was already 1-based paragraph index; after slice(1), paragraph at original index 1 is now at 0
        }
        return doc.matches.map(m => m.index + 1);
    }, [doc]);

    if (!doc) return null;

    const isLast = index === results.length - 1;

    return (
        <div style={style}>
            <div ref={rowRef} className={!isLast ? styles.separator : ''}>
                <Article
                    selectedTag={doc.tag}
                    content={content}
                    filteredParagraphs={filteredParagraphs}
                    onTitleClick={() => gotoArticle(doc.tag)}
                    embedded={true}
                    hidePlayer={true}
                    highlight={highlight}
                    customTags={doc.customTags}
                />
            </div>
        </div>
    );
};

export default React.memo(SearchResultItem);
