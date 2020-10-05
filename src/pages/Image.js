import styles from "./Image.module.scss";
import { useEffect, useState, useCallback, useContext, useRef } from "react";
import { useParentPath } from "@/util/pages";
import { readBinary } from "@/util/binary";
import Progress from "@/widgets/Progress";
import { useSync } from "@/util/sync";
import { PageSize } from "@/components/Page";
import { useTranslations } from "@/util/translations";
import Download from "@/widgets/Download";
import { exportData } from "@/util/importExport";

export default function ImagePage({ name }) {
    const translations = useTranslations();
    const size = useContext(PageSize);
    const [syncCounter] = useSync();
    const path = (useParentPath() + "/" + name).split("/").slice(1).join("/");
    const busyRef = useRef(false);
    const [loading, setLoading] = useState(false);
    const [content, setContent] = useState(null);
    const [src, setSrc] = useState(null);
    const [error, setError] = useState(null);
    const readFile = useCallback(async () => {
        if (busyRef.current) {
            return;
        }
        busyRef.current = true;
        setLoading(true);
        try {
            const content = await readBinary(path);
            setContent(content);
            setLoading(false);
        }
        catch (err) {
            console.error(err);
            setError(err);
            setContent(null);
            setLoading(false);
        }
        busyRef.current = false;
    }, []);
    useEffect(() => {
        readFile();
    }, []);

    useEffect(() => {
        readFile();
    }, [syncCounter]);

    useEffect(() => {
        if (content) {
            var reader = new FileReader();
            reader.addEventListener("load", () => {
                setSrc(reader.result);
            }, false);
            reader.readAsDataURL(content);
        }
    }, [content]);


    const downloadImage = () => {
        exportData(content, name);
    };
    const style = { height: size.height - 22, width: size.width - 22 };

    return <div className={styles.root}>
        <Download visible={!loading} onClick={downloadImage} />
        {!loading && <img className={styles.img} src={src} />}
        {loading && <Progress />}
    </div>;
}
