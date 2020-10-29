import styles from "./Group.module.scss";
import clsx from "clsx";

export default function Group({ fill, name, color }) {
    const groupName = name && name[0].toUpperCase() + name.slice(1);
    const style = { backgroundColor: color };
    return <div className={clsx(styles.groupContainer, fill && styles.fill)}>
        <div className={clsx(styles.background, fill && styles.fill)} style={style} />
        <div className={clsx(styles.group, fill && styles.fill)} dir="auto">
            {groupName}
        </div>
        <div className={clsx(styles.backgroundBorder, fill && styles.fill)} style={style} />
    </div>;
};