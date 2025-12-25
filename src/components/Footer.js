import styles from "./Footer.module.scss";
import Toolbar, { useToolbarItems } from "./Toolbar";

export default function Footer() {
    const items = useToolbarItems({ location: "footer" });
    if (!items || !items.length) {
        return null;
    }
    return <div className={styles.root}>
        <Toolbar location="footer" />
    </div>;
}
