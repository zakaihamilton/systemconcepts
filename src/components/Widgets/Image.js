import styles from "./Image.module.scss";
import { useState, useEffect, useRef } from "react";
import Progress from "@widgets/Progress";
import clsx from "clsx";
import Link from "@mui/material/Link";
import { useFetchJSON } from "@util/fetch";

export default function ImageWidget({ className, onClick, href, loading, path, thumbnail, width, height, alt, showProgress = true, onLoad: onLoadCallback }) {
    const isWasabi = path && path.startsWith("wasabi/");
    const [data] = useFetchJSON(isWasabi && "/api/player", { headers: { path: encodeURIComponent(path) } }, [path], isWasabi);
    const [imageLoading, setImageLoading] = useState(false);
    const [loaded, setLoaded] = useState(false);
    const [error, setError] = useState(false);
    const imgRef = useRef(null);
    const currentPathRef = useRef("INITIAL_SENTINEL");

    const effectivePath = isWasabi ? (data && data.path) : path;
    const loadingAttribute = typeof loading === "string" ? loading : undefined;

    const onLoad = () => {
        setImageLoading(false);
        setLoaded(true);
        if (onLoadCallback) onLoadCallback();
    };

    const onError = () => {
        setError(true);
        setImageLoading(false);
        setLoaded(false);
    };

    const buttonStyle = { minWidth: width, minHeight: height };
    const imageStyle = { width, height };

    const hasPath = typeof effectivePath === "string" && effectivePath;

    // Handle path changes
    useEffect(() => {
        if (effectivePath !== currentPathRef.current) {
            currentPathRef.current = effectivePath;

            if (hasPath) {
                const img = imgRef.current;
                // Check if image is already loaded (cached)
                if (img && img.complete && img.naturalHeight !== 0) {
                    setTimeout(() => {
                        setImageLoading(false);
                        setLoaded(true);
                        setError(false);
                        if (onLoadCallback) onLoadCallback();
                    }, 0);
                } else {
                    setTimeout(() => {
                        setImageLoading(true);
                        setLoaded(false);
                        setError(false);
                    }, 0);
                }
            } else {
                setTimeout(() => {
                    setImageLoading(false);
                    setLoaded(false);
                    setError(false);
                }, 0);
            }
        }
    }, [effectivePath, hasPath, onLoadCallback]);

    const isExternalLoading = (typeof loading === "boolean" && loading) || (isWasabi && !data);

    const showAlt = (!hasPath || !!error) && (!isExternalLoading && !imageLoading);
    const clickable = !!onClick;

    return <Link underline="none" href={href} color="initial" style={buttonStyle} className={clsx(styles.root, className, clickable && styles.clickable)} disabled={(!hasPath || !!error)} onClick={clickable ? onClick : undefined}>
        {showProgress && (!!isExternalLoading || (!!imageLoading && !loaded && !thumbnail)) && <Progress fullscreen={true} />}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {hasPath && !error && <img loading={loadingAttribute} key={effectivePath} ref={imgRef} draggable={false} style={imageStyle} className={clsx(styles.img, !loaded && styles.hidden)} onError={onError} onLoad={onLoad} src={effectivePath} alt={alt} />}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {thumbnail && thumbnail !== effectivePath && <img src={thumbnail} style={imageStyle} className={clsx(styles.img, loaded && styles.hidden)} alt={alt} />}
        {showAlt && <div className={styles.alt}>{alt}</div>}
    </Link>;
}
