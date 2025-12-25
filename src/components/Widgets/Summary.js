import LinearProgress from "@mui/material/LinearProgress";
import ReactMarkdown from "react-markdown";
import { useFetch } from "@util/fetch";
import styles from "./Summary.module.scss";
import { useTranslations } from "@util/translations";

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

    return <div className={styles.root}>
        <ReactMarkdown>{displayedContent}</ReactMarkdown>
    </div>;
}
