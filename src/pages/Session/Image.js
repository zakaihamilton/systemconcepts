import styles from "./Image.module.scss";
import { useState, useEffect } from "react";
import Progress from "@/widgets/Progress";
import clsx from "clsx";
import { addPath } from "@/util/pages";

export default function SessionImage({ loading, path, width, height, alt }) {
    const [imageLoading, setImageLoading] = useState(false);
    const [error, setError] = useState(false);
    const onLoad = () => {
        setImageLoading(false);
    }
    const onError = () => {
        setError(true);
        setImageLoading(false);
    }

    const style = { width, height };

    const gotoImage = () => {
        addPath("image");
    }

    useEffect(() => {
        if (path) {
            setImageLoading(true);
        }
        else {
            setImageLoading(false);
        }
    }, [path]);

    return <button style={style} className={styles.root} disabled={!path || !!error} onClick={gotoImage}>
        {(!!loading || !!imageLoading) && <Progress fullscreen={true} />}
        {path && !error && <img draggable={false} className={clsx(styles.img, loading && styles.loading)} onError={onError} onLoad={onLoad} src={path} />}
        {(!path || !!error) && (!loading && !imageLoading) && <div className={styles.alt}>{alt}</div>}
    </button>;
}
