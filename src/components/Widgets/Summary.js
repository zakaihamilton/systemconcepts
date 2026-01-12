import LinearProgress from "@mui/material/LinearProgress";
import ReactMarkdown from "react-markdown";
import { useFetch } from "@util/fetch";
import styles from "./Summary.module.scss";
import { useTranslations } from "@util/translations";

/**
 * Preprocess markdown content to ensure proper line breaks
 * Handles cases where content is all on one line
 */
function preprocessMarkdown(content) {
    if (!content) return content;

    let result = content;

    // Add line breaks before bold headers (like **Key Points:** or **Main Takeaways:**)
    result = result.replace(/\s*(\*\*[^*]+:\*\*)\s*/g, '\n\n$1\n\n');

    // Add line breaks before list items (- item)
    result = result.replace(/\s+-\s+\*\*/g, '\n\n- **');
    result = result.replace(/\s+-\s+(?!\*)/g, '\n- ');

    // Add line breaks before numbered items (1. item, 2. item, etc.)
    result = result.replace(/\s+(\d+\.)\s+/g, '\n$1 ');

    // Clean up excessive newlines
    result = result.replace(/\n{3,}/g, '\n\n');

    return result.trim();
}

export default function Summary({ path }) {
    const translations = useTranslations();
    const url = path ? "/api/summary?path=" + encodeURIComponent(path) : null;
    const [data, , loading] = useFetch(url);
    const displayedContent = path && !loading && data;

    if (loading) {
        return <div className={styles.progress}>
            <LinearProgress />
        </div>;
    }

    if (!displayedContent) {
        return <div className={styles.noSummary}>{translations.NO_SUMMARY}</div>;
    }

    const formattedContent = preprocessMarkdown(displayedContent);

    return <div className={styles.root}>
        <ReactMarkdown>{formattedContent}</ReactMarkdown>
    </div>;
}

