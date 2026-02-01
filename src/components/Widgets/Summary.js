import LinearProgress from "@mui/material/LinearProgress";
import ReactMarkdown from "react-markdown";
import { useFetch } from "@util/fetch";
import styles from "./Summary.module.scss";
import { useTranslations } from "@util/translations";

import { preprocessMarkdown } from "@util/string";

export default function Summary({ path, content, loading }) {
    const translations = useTranslations();
    const url = path && !content ? "/api/summary?path=" + encodeURIComponent(path) : null;
    const [data, , loadingData] = useFetch(url);
    const displayedContent = content || (path && !loadingData && data);

    if ((loading || loadingData) && !content) {
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

