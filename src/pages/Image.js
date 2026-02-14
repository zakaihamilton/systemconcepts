import styles from "./Image.module.scss";
import { useEffect, useState, useCallback, useContext, useRef } from "react";
import { useParentPath, useParentParams } from "@util/pages";
import { readBinary } from "@util/binary";
import Progress from "@widgets/Progress";
import { useSync } from "@sync/sync";
import { ContentSize } from "@components/Page/Content";
import Download from "@widgets/Download";
import { exportData, exportFile } from "@util/importExport";
import { makePath } from "@util/path";
import { useFetchJSON } from "@util/fetch";
import Message from "@widgets/Message";
import { useTranslations } from "@util/translations";
import ErrorIcon from "@mui/icons-material/Error";

function useImagePath(imageName = "", extension) {
    const { prefix = "sessions", group = "", year = "", date = "", name } = useParentParams();
    const parentPath = useParentPath();
    let path = "";
    if (group) {
        let components = [prefix, group, year, date + " " + name + "." + extension].filter(Boolean).join("/");
        path = makePath(components).split("/").join("/");
    }
    else {
        if (imageName.endsWith("." + extension)) {
            path = (parentPath + "/" + imageName).split("/").slice(1).join("/");
        }
        else {
            path = (parentPath + "/" + imageName + "." + extension).split("/").slice(1).join("/");
        }
    }
    const [data, , loading] = useFetchJSON("/api/player", { headers: { path: encodeURIComponent(path) } }, [path], path && group);
    let downloadUrl = "";
    if (path && group) {
        if (data) {
            path = data.path || "";
            downloadUrl = data.downloadUrl || "";
        }
    }

    return { path, downloadUrl, loading };
}

export default function ImagePage({ name, ext = "png" }) {
    const translations = useTranslations();
    const size = useContext(ContentSize);
    const [syncCounter] = useSync();
    const { path, downloadUrl, loading: signingLoading } = useImagePath(name, ext);
    const busyRef = useRef(false);
    const [loading, setLoading] = useState(false);
    const [imageLoading, setImageLoading] = useState(true);
    const [content, setContent] = useState(null);
    const [src, setSrc] = useState(null);
    const [error, setError] = useState(null);
    const onLoad = () => {
        setImageLoading(false);
    };
    const onError = (event) => {
        console.warn("Failed to load image", event);
        setError(true);
        setImageLoading(false);
    };

    const readFile = useCallback(async () => {
        if (busyRef.current) {
            return;
        }
        busyRef.current = true;
        setLoading(true);
        setError(null);
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
            const errorString = String(err);
            if (errorString.includes("FILE_NOT_FOUND") && signingLoading) {
                // Ignore local file not found if we are still fetching signed URL
                console.log("Local image not found, waiting for signed URL...");
                setLoading(false);
            } else {
                console.warn("Failed to read image", err);
                setError(err);
                setContent(null);
                setLoading(false);
            }
        }
        busyRef.current = false;
    }, [path, signingLoading]);
    useEffect(() => {
        if (path) {
            readFile();
        }
    }, [path, readFile]);

    useEffect(() => {
        if (path) {
            readFile();
        }
    }, [syncCounter, path, readFile]);

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
        if (downloadUrl) {
            exportFile(downloadUrl, name + "." + ext);
        }
        else if (content) {
            exportData(content, name);
        }
        else {
            exportFile(path, name);
        }
    };
    const style = { height: size.height - 22, width: size.width - 22 };

    return <div className={styles.root}>
        <Download visible={!loading && !imageLoading && !error && !signingLoading} onClick={downloadUrl ? undefined : downloadImage} target={downloadUrl} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {!loading && !error && src && <img alt={name} className={styles.img} onError={onError} onLoad={onLoad} style={{ ...style, visibility: imageLoading ? "hidden" : "visible" }} src={src} />}
        {(!!loading || !!imageLoading || !!signingLoading) && <Progress fullscreen={true} />}
        {!!error && <Message Icon={ErrorIcon} label={translations.CANNOT_LOAD_IMAGE} />}
    </div>;
}
