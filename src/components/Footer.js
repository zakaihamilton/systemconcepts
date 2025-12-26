import styles from "./Footer.module.scss";
import Toolbar, { useToolbarItems } from "./Toolbar";
import { useDeviceType } from "@util/styles";

export default function Footer() {
    const isMobile = useDeviceType() === "phone";
    const items = useToolbarItems({ location: "footer" });
    if (!items || !items.length) {
        return null;
    }
    return <div className={styles.root}>
        <Toolbar location="footer" className={styles.footer + (isMobile ? " " + styles.spaced : "")} />
        {isMobile && <Toolbar location="mobile" className={styles.mobile} />}
    </div>;
}
