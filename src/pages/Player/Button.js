import styles from "./Button.module.scss";
import clsx from "clsx";

export default function Button({ id, name, icon, active, subHeading, onClick, ...props }) {
    return <button className={clsx(styles.root, active && styles.active)} onClick={onClick} {...props}>
        <div className={styles.icon}>
            {icon}
        </div>
        <div className={styles.label}>
            {name}
        </div>
        {subHeading && <div className={styles.subHeading}>
            {subHeading}
        </div>}
    </button>;
}