import styles from "./SwipeIndicator.module.scss";
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import clsx from "clsx";
import { createPortal } from "react-dom";

export default function SwipeIndicator({ direction }) {
    if (typeof document === "undefined") {
        return null;
    }
    return createPortal(<div className={clsx(styles.root, direction && styles.visible)} data-direction={direction}>
        <div className={styles.icon}>
            {direction === "left" && <ArrowForwardIcon fontSize="inherit" />}
            {direction === "right" && <ArrowBackIcon fontSize="inherit" />}
        </div>
    </div>, document.body);
}
