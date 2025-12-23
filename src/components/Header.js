import styles from "./Header.module.scss";
import Toolbar from "./Toolbar";
import { useDeviceType } from "@util/styles";

export default function Header() {
    const deviceType = useDeviceType();
    const isPhone = deviceType === "phone";
    const isDesktop = deviceType === "desktop";
    if (isPhone || isDesktop) {
        return null;
    }
    return <div className={styles.root}>
        <Toolbar className={styles.toolbar} location="header" />
    </div>;
}
