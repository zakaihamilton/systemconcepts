import styles from "./Image.module.scss";
import { useState, useEffect, useRef } from "react";
import Progress from "@widgets/Progress";
import clsx from "clsx";
import Link from "@mui/material/Link";

export default function ImageWidget({ className, onClick, href, loading, path, width, height, alt, showProgress = true, onLoad: onLoadCallback }) {
    const [imageLoading, setImageLoading] = useState(false);
    const [loaded, setLoaded] = useState(false);
    const [error, setError] = useState(false);
    const imgRef = useRef(null);
    const currentPathRef = useRef("INITIAL_SENTINEL");

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

    const hasPath = typeof path === "string" && path;

    // Handle path changes
    useEffect(() => {
        if (path !== currentPathRef.current) {
            currentPathRef.current = path;

            if (hasPath) {
                const img = imgRef.current;
                // Check if image is already loaded (cached)
                if (img && img.complete && img.naturalHeight !== 0) {
                    setImageLoading(false);
                    setLoaded(true);
                    setError(false);
                    if (onLoadCallback) onLoadCallback();
                } else {
                    setImageLoading(true);
                    setLoaded(false);
                    setError(false);
                }
            } else {
                setImageLoading(false);
                setLoaded(false);
                setError(false);
            }
        }
    }, [path, hasPath, onLoadCallback]);

    const isExternalLoading = typeof loading === "boolean" && loading;
    const loadingAttribute = typeof loading === "string" ? loading : undefined;

    const showAlt = (!hasPath || !!error) && (!isExternalLoading && !imageLoading);
    const clickable = !!onClick;

    return <Link underline="none" href={href} color="initial" style={buttonStyle} className={clsx(styles.root, className, clickable && styles.clickable)} disabled={(!hasPath || !!error)} onClick={clickable ? onClick : undefined}>
        {showProgress && (!!isExternalLoading || (!!imageLoading && !loaded)) && <Progress fullscreen={true} />}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {hasPath && !error && <img loading={loadingAttribute} key={path} ref={imgRef} draggable={false} style={imageStyle} className={clsx(styles.img, !loaded && styles.hidden)} onError={onError} onLoad={onLoad} src={path} alt={alt} />}
        {showAlt && <div className={styles.alt}>{alt}</div>}
    </Link>;
}
