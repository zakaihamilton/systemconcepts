import styles from "./Header.module.scss";
import Toolbar from "./Toolbar";

export default function Header() {
    return <div className={styles.root}>
        <Toolbar className={styles.toolbar} location="header" />
    </div>;
}
