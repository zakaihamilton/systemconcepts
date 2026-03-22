
import Box from "@mui/material/Box";
import Markdown from "./Markdown";
import articleStyles from "../Article.module.css";
import styles from "./Content.module.css";

export default function Content({ showMarkdown, search, currentParagraphIndex, selectedTag, processedContent, filteredParagraphs, highlight, disableGlossary }) {
    return (
        <Box className={articleStyles.centeredContent}>
            {showMarkdown ? (
                <Markdown search={highlight || search} currentParagraphIndex={currentParagraphIndex} selectedTag={selectedTag} filteredParagraphs={filteredParagraphs} disableGlossary={disableGlossary}>
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
