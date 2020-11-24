import styles from "./Tab.module.scss";
import { useDeviceType } from "@util/styles";
import clsx from "clsx";
import Tab from "@material-ui/core/Tab";

export default function TabWidget({ icon, label, value, ...props }) {
    const isPhone = useDeviceType() === "phone";
    const content = <div className={clsx(styles.content, isPhone && styles.mobile)}>
        {icon}
        <div className={clsx(styles.label, isPhone && styles.mobile)}> {label}</div>
    </div>;
    return <Tab className={styles.root} label={content} value={value} {...props} />;
}