import React from "react";
import Box from "@mui/material/Box";
import Markdown from "./Markdown";
import articleStyles from "../Article.module.scss";
import styles from "./Content.module.scss";

export default function Content({ showMarkdown, search, currentParagraphIndex, selectedTag, processedContent, filteredParagraphs, highlight }) {
    return (
        <Box className={articleStyles.centeredContent}>
            {showMarkdown ? (
                <Markdown search={highlight || search} currentParagraphIndex={currentParagraphIndex} selectedTag={selectedTag} filteredParagraphs={filteredParagraphs}>
                    {processedContent}
                </Markdown>
            ) : (
                <Box
                    component="pre"
                    className={styles.textContent}
                >
                    {processedContent}
                </Box>
            )}
        </Box>
    );
}
