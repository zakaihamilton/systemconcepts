import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { useFetch } from "@util/fetch";
import styles from "./Summary.module.scss";

export default function Summary({ path }) {
    const [content, setContent] = useState("");
    const url = path ? "/api/summary?path=" + encodeURIComponent(path) : null;
    const [data] = useFetch(url);

    useEffect(() => {
        if (data) {
            setContent(data);
        }
    }, [data]);

    if (!content) {
        return null;
    }

    return <div className={styles.root}>
        <ReactMarkdown>{content}</ReactMarkdown>
    </div>;
}
