import styles from "./Row.module.scss";
import clsx from "clsx";

export default function RowWidget({ className, children, ...props }) {
    return <div className={clsx(styles.root, className)} {...props}>
        {children}
    </div>;
}
