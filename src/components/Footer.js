import styles from "./Footer.module.scss";
import Toolbar from "./Toolbar";

export default function Footer() {
    return <div className={styles.root}>
        <Toolbar location="footer" />
    </div>;
}
