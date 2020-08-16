import styles from "./Row.module.scss";
import clsx from "clsx";

export default function RowWidget({ children, ...props }) {
    return <div className={clsx(styles.root)} {...props}>
        {children}
    </div>;
}
