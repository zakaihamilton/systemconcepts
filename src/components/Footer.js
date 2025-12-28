import clsx from "clsx";
import styles from "./Footer.module.scss";
import Toolbar, { useToolbarItems } from "./Toolbar";
import { useDeviceType } from "@util/styles";

export default function Footer() {
    const isMobile = useDeviceType() === "phone";
    const footerItems = useToolbarItems({ location: "footer" });
    const mobileItems = useToolbarItems({ location: "mobile" });
    if (!footerItems?.length && !mobileItems?.length) {
        return null;
    }
    return <div className={clsx(styles.root, isMobile && styles.relative)}>
        <Toolbar location="footer" className={styles.footer + (isMobile ? " " + styles.spaced : "")} />
        {isMobile && <Toolbar location="mobile" className={styles.mobile} />}
    </div>;
}
