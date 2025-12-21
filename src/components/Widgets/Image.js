import styles from "./Image.module.scss";
import { useState, useEffect } from "react";
import Progress from "@widgets/Progress";
import clsx from "clsx";
import { addPath } from "@util/pages";
import Link from "@mui/material/Link";

export default function ImageWidget({ clickForImage = true, onClick, href, loading, path, width, height, alt }) {
    const [imageLoading, setImageLoading] = useState(false);
    const [error, setError] = useState(false);
    const onLoad = () => {
        setImageLoading(false);
    };
    const onError = () => {
        setError(true);
        setImageLoading(false);
    };

    const buttonStyle = { minWidth: width, minHeight: height };
    const imageStyle = { width, height };

    const gotoImage = () => {
        addPath("image?label=THUMBNAIL");
    };

    const hasPath = typeof path === "string" && path;

    useEffect(() => {
        setImageLoading(!!hasPath);
    }, [hasPath]);

    const showAlt = (!hasPath || !!error) && (!loading && !imageLoading);
    const clickable = clickForImage && !showAlt || onClick;

    if (clickForImage) {
        onClick = gotoImage;
    }

    return <Link underline="none" href={href} color="initial" style={buttonStyle} className={clsx(styles.root, clickable && styles.clickable)} disabled={clickForImage && (!hasPath || !!error)} onClick={clickable ? onClick : undefined}>
        {(!!loading || !!imageLoading) && <Progress fullscreen={true} />}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {hasPath && !error && <img draggable={false} style={imageStyle} className={clsx(styles.img, loading && styles.loading)} onError={onError} onLoad={onLoad} src={path} alt={alt} />}
        {showAlt && <div className={styles.alt}>{alt}</div>}
    </Link>;
}
