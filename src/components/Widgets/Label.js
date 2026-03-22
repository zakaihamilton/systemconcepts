import styles from "./Label.module.css";
import clsx from "clsx";

export default function LabelWidget({ icon, onClick, noBorder, name, children, className, ...props }) {
    if (onClick) {
        return <button onClick={onClick} className={clsx(styles.root, styles.button, noBorder && styles.noBorder, className)} {...props}>
            {icon}
            {name}
            {children}
        </button>;
    }
    return <div className={clsx(styles.root, className)} {...props}>
        {icon}
        {name}
        {children}
    </div>;
}
