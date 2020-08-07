import styles from "./Label.module.scss";
import clsx from "clsx";

export default function LabelWidget({ icon, onClick, name }) {
    if (onClick) {
        return <button onClick={onClick} className={clsx(styles.root, styles.button)}>
            {icon}
            {name}
        </button>;
    }
    return <div className={styles.root}>
        {icon}
        {name}
    </div>;
}
