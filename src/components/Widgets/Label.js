import styles from "./Label.module.scss";
import clsx from "clsx";

export default function LabelWidget({ icon: Icon, onClick, name }) {
    if (onClick) {
        return <button onClick={onClick} className={clsx(styles.root, styles.button)}>
            {Icon && <Icon />}
            {name}
        </button>;
    }
    return <div className={styles.root}>
        {Icon && <Icon />}
        {name}
    </div>;
}
