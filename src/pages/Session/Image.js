import styles from "./Image.module.scss";
import { useState } from "react";
import Progress from "@/widgets/Progress";
import clsx from "clsx";

export default function SessionImage({ path, width, height }) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const onLoad = () => {
        setLoading(false);
    }
    const onError = () => {
        setError(true);
        setLoading(false);
    }

    const style = { width, height };

    return <div className={styles.root}>
        {loading && <Progress />}
        {path && !error && <img className={clsx(styles.img, loading && styles.loading)} style={style} onError={onError} onLoad={onLoad} src={path} />}
    </div>;
}
