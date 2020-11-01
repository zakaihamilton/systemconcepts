import styles from "./Image.module.scss";
import { useEffect, useState, useCallback, useContext, useRef } from "react";
import { useParentPath, useParentParams } from "@util/pages";
import { readBinary } from "@util/binary";
import Progress from "@widgets/Progress";
import { useSync } from "@util/sync";
import { PageSize } from "@components/Page";
import Download from "@widgets/Download";
import { exportData, exportFile } from "@util/importExport";
import { makePath } from "@util/path";
import { useFetchJSON } from "@util/fetch";

function useImagePath(imageName = "") {
    const { prefix = "sessions", group = "", year = "", date = "", name } = useParentParams();
    let path = "";
    if (group) {
        let components = [prefix, group, year, date + " " + name + ".png"].filter(Boolean).join("/");
        path = makePath(components).split("/").join("/");
        const [data] = useFetchJSON("/api/player", { headers: { path: encodeURIComponent(path) } }, [path], path);
        path = data && data.path || "";
    }
    else {
        path = (useParentPath() + "/" + imageName).split("/").slice(1).join("/");
    }
    return path;
}

export default function ImagePage({ name }) {
    const size = useContext(PageSize);
    const [syncCounter] = useSync();
    const path = useImagePath(name);
    const busyRef = useRef(false);
    const [loading, setLoading] = useState(false);
    const [imageLoading, setImageLoading] = useState(true);
    const [content, setContent] = useState(null);
    const [src, setSrc] = useState(null);
    const [error, setError] = useState(null);
    const onLoad = () => {
        setImageLoading(false);
    }
    const onError = () => {
        setError(true);
        setImageLoading(false);
    }

    const readFile = useCallback(async () => {
        if (busyRef.current) {
            return;
        }
        busyRef.current = true;
        setLoading(true);
        try {
            if (path.startsWith("https")) {
                setSrc(path);
            }
            else {
                const content = await readBinary(path);
                setContent(content);
            }
            setLoading(false);
        }
        catch (err) {
            console.error(err);
            setError(err);
            setContent(null);
            setLoading(false);
        }
        busyRef.current = false;
    }, [path]);
    useEffect(() => {
        if (path) {
            readFile();
        }
    }, [path]);

    useEffect(() => {
        if (path) {
            readFile();
        }
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
        if (content) {
            exportData(content, name);
        }
        else {
            exportFile(path, name);
        }
    };
    const style = { height: size.height - 22, width: size.width - 22 };

    return <div className={styles.root}>
        <Download visible={!loading && !imageLoading} onClick={downloadImage} />
        {!loading && !error && <img className={styles.img} onError={onError} onLoad={onLoad} style={style} src={src} />}
        {(!!loading || !!imageLoading) && <Progress fullscreen={true} />}
    </div>;
}
