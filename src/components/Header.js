import styles from "./Header.module.scss";
import Toolbar from "./Toolbar";
import { useDeviceType } from "@util/styles";

export default function Header() {
    const isPhone = useDeviceType() === "phone";
    if (isPhone) {
        return null;
    }
    return <div className={styles.root}>
        <Toolbar className={styles.toolbar} location="header" />
    </div>;
}
