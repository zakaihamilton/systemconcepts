
import LinearProgress from "@mui/material/LinearProgress";
import styles from "./Loading.module.scss";

export default function Loading({ error }) {
    if (error) {
        console.error(error);
    }
    return (
        <div className={styles.root}>
            <div className={styles.progress}>
                <LinearProgress />
            </div>
        </div>
    );
}
