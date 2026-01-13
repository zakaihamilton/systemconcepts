import styles from "./Button.module.scss";
import clsx from "clsx";

export default function Button({ name, icon, active, subHeading, onClick, label, ...props }) {
    // Remove active from props to prevent it from being passed to DOM
    const { active: _unused, ...buttonProps } = { active, ...props }; // eslint-disable-line no-unused-vars

    return <button
        className={clsx(styles.root, active && styles.active)}
        onClick={onClick}
        aria-label={label}
        {...buttonProps}
    >
        <div className={styles.icon} aria-hidden="true">
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
