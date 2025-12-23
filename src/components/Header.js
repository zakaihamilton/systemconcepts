import styles from "./Header.module.scss";
import Toolbar from "./Toolbar";
import { useDeviceType } from "@util/styles";
import { Divider } from "@mui/material";

export default function Header() {
    const deviceType = useDeviceType();
    const isPhone = deviceType === "phone";
    const isDesktop = deviceType === "desktop";
    if (isPhone) {
        return null;
    }
    return <div className={styles.root}>
        <Toolbar className={styles.toolbar} location="header" />
        {isDesktop && <>
            <Divider orientation="vertical" flexItem className={styles.divider} />
            <Toolbar className={styles.iconToolbar} location={undefined} />
        </>}
    </div>;
}
