import styles from "./SwipeIndicator.module.scss";
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import clsx from "clsx";

export default function SwipeIndicator({ direction }) {
    return <div className={clsx(styles.root, direction && styles.visible)} data-direction={direction}>
        <div className={styles.icon}>
            {direction === "left" && <ArrowForwardIcon fontSize="inherit" />}
            {direction === "right" && <ArrowBackIcon fontSize="inherit" />}
        </div>
    </div>
}
