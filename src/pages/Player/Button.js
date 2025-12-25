import styles from "./Button.module.scss";
import clsx from "clsx";

export default function Button({ id, name, icon, active, subHeading, onClick, ...props }) {
    // Remove active from props to prevent it from being passed to DOM
    const { active: _, ...buttonProps } = { active, ...props };

    return <button className={clsx(styles.root, active && styles.active)} onClick={onClick} {...buttonProps}>
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