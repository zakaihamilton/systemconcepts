import React, { useRef, useEffect, useMemo } from "react";
import styles from "./SearchResultItem.module.scss";
import Article from "@pages/Library/Article";
import { normalizeContent } from "@util/string";

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
        if (doc?.paragraphs) return doc.paragraphs.join("\n\n");
        return "";
    }, [doc]);
    // filteredParagraphs contains 1-based indices of paragraphs to display
    const filteredParagraphs = useMemo(() => doc?.matches?.map(m => m.index + 1) || [], [doc]);

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

export default SearchResultItem;
